#requires -Version 7.4
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:AppApi = '2026-03-02-preview'
$script:ContributorRole = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

function Invoke-AzureCli {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $PSNativeCommandUseErrorActionPreference = $false
    $launcher = Get-Command az -ErrorAction Stop
    $python = $null
    if ($IsWindows -and [IO.Path]::GetExtension($launcher.Source) -eq '.cmd') {
        $candidate = [IO.Path]::GetFullPath((Join-Path (Split-Path $launcher.Source -Parent) '..\python.exe'))
        if (Test-Path -LiteralPath $candidate) { $python = $candidate }
    }
    if ($python) {
        # Preserve the Windows CLI's isolated mode while making redirected build logs Unicode-safe.
        & $python -X utf8 -IBm azure.cli @Arguments
    }
    else { & az @Arguments }
    $script:AzExitCode = $LASTEXITCODE
}

function Invoke-AzJson {
    param([Parameter(Mandatory)][string[]]$Arguments, [switch]$Sensitive)
    $errorFile = [IO.Path]::GetTempFileName()
    try {
        $text = Invoke-AzureCli -Arguments ($Arguments + @('--only-show-errors', '--output', 'json')) 2> $errorFile
        if ($script:AzExitCode -ne 0) {
            $detail = if ($Sensitive) { 'Credential-bearing command details suppressed.' } else { Get-Content $errorFile -Raw }
            throw "Azure CLI failed (exit $script:AzExitCode): $detail"
        }
        if ($text) { return ($text -join "`n" | ConvertFrom-Json -AsHashtable) }
    }
    finally { Remove-Item -LiteralPath $errorFile -Force }
}

function Write-PrivateJson {
    param([Parameter(Mandatory)]$Value)
    $path = [IO.Path]::GetTempFileName()
    try {
        if (-not $IsWindows) {
            [IO.File]::SetUnixFileMode($path, [IO.UnixFileMode]::UserRead -bor [IO.UnixFileMode]::UserWrite)
        }
        [IO.File]::WriteAllText($path, ($Value | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
        return $path
    }
    catch {
        Remove-Item -LiteralPath $path -Force
        throw
    }
}

function Invoke-Arm {
    param(
        [Parameter(Mandatory)][string]$ResourceId,
        [string]$ApiVersion = $script:AppApi,
        [ValidateSet('get', 'put', 'patch', 'post', 'delete')][string]$Method = 'get',
        $Body,
        [switch]$Sensitive
    )
    if ($ResourceId -notmatch '^/subscriptions/[0-9a-f-]+/resourceGroups/[^/]+/providers/') {
        throw 'Expected an explicit resource-group-scoped Azure resource ID.'
    }
    $arguments = @('rest', '--method', $Method, '--url', "https://management.azure.com${ResourceId}?api-version=$ApiVersion")
    $path = $null
    try {
        if ($null -ne $Body) {
            $path = Write-PrivateJson $Body
            $arguments += @('--body', "@$path", '--headers', 'Content-Type=application/json')
        }
        return Invoke-AzJson -Arguments $arguments -Sensitive:$Sensitive
    }
    finally { if ($path) { Remove-Item -LiteralPath $path -Force } }
}

function Read-PublishSettings {
    param([Parameter(Mandatory)][string]$Path)
    $settings = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -AsHashtable
    foreach ($key in @('subscriptionId', 'resourceGroup', 'appId', 'containerId', 'identityId', 'identityPrincipalId', 'storageId')) {
        if (-not $settings[$key]) { throw "Settings are missing '$key'." }
    }
    $scope = "/subscriptions/$($settings.subscriptionId)/resourceGroups/$($settings.resourceGroup)/providers/"
    foreach ($key in @('appId', 'containerId', 'storageId', 'identityId')) {
        if (-not $settings[$key].StartsWith($scope, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Settings '$key' is outside the declared resource group."
        }
    }
    if ($settings.containerId -notmatch ('^' + [regex]::Escape($settings.storageId) + '/blobServices/default/containers/[^/]+$')) {
        throw 'Container must belong to the configured storage account.'
    }
    if ($settings['contributorAssignmentId'] -and $settings.contributorAssignmentId -notmatch (
        '^' + [regex]::Escape($settings.containerId) + '/providers/Microsoft.Authorization/roleAssignments/[0-9a-f-]{36}$')) {
        throw 'Recovery role assignment must be at the exact configured container scope.'
    }
    return $settings
}

function Get-SiteOrigin {
    param([Parameter(Mandatory)]$App)
    $hostName = [string]$App.properties.configuration.ingress.fqdn
    if ($hostName -notmatch '^[a-z0-9.-]+\.azurecontainerapps\.io$') {
        throw 'Expected the actual ACA-generated HTTPS hostname; refusing an unverified publishing destination.'
    }
    return "https://$hostName"
}

function Assert-PrivateStorage {
    param([Parameter(Mandatory)]$Settings)
    $storage = Invoke-Arm $Settings.storageId -ApiVersion '2023-05-01'
    $p = $storage.properties
    if ($p.publicNetworkAccess -ne 'Disabled' -or $p.allowBlobPublicAccess -ne $false -or
        $p.allowSharedKeyAccess -ne $false -or $p.networkAcls.defaultAction -ne 'Deny' -or
        $p.accessTier -ne 'Cool') {
        throw 'Storage does not meet the private-only, no-key, Cool-tier contract. Publishing stopped.'
    }
}

function Assert-PublishIdentity {
    param([Parameter(Mandatory)]$Settings, [Parameter(Mandatory)]$App)
    if (@($App.identity.userAssignedIdentities.Keys | Where-Object { $_ -eq $Settings.identityId }).Count -ne 1) {
        throw 'The configured publishing identity is not attached to this application.'
    }
    $identity = Invoke-Arm $Settings.identityId -ApiVersion '2023-01-31'
    if ($identity.properties.principalId -ne $Settings.identityPrincipalId) {
        throw 'The publishing principal does not match the configured user-assigned identity.'
    }
}

function Wait-AppProvisioning {
    param([Parameter(Mandatory)][string]$AppId, [int]$TimeoutSeconds = 900)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $app = Invoke-Arm $AppId
        switch ($app.properties.provisioningState) {
            'Succeeded' { return $app }
            'Failed' { throw 'Container app provisioning failed. Inspect the Azure deployment/revision diagnostics.' }
            'Canceled' { throw 'Container app provisioning was canceled.' }
        }
        Start-Sleep -Seconds 5
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Timed out waiting for container app provisioning.'
}

function Set-AppVariables {
    param([Parameter(Mandatory)]$Settings, [Parameter(Mandatory)][hashtable]$Variables, [string[]]$Remove = @())
    $app = Invoke-Arm $Settings.appId
    $containers = @($app.properties.template.containers)
    if ($containers.Count -ne 1 -or $containers[0].name -ne 'web') { throw 'Expected this skill''s single web container.' }
    $environment = @($containers[0].env | Where-Object { $_.name -notin $Remove -and -not $Variables.ContainsKey($_.name) })
    foreach ($entry in $Variables.GetEnumerator()) {
        $environment += @{ name = $entry.Key; value = [string]$entry.Value }
    }
    $containers[0].env = $environment
    return Save-WebApp $Settings $app
}

function Save-WebApp {
    param([Parameter(Mandatory)]$Settings, [Parameter(Mandatory)]$App, [object[]]$Secrets)
    if ($null -eq $Secrets) {
        $current = Invoke-Arm "$($Settings.appId)/listSecrets" -Method post -Sensitive
        $Secrets = @($current.value)
    }
    $App.properties.template.Remove('revisionSuffix')
    $configuration = $App.properties.configuration
    $configuration.secrets = $Secrets
    $configuration.ingress.Remove('fqdn')
    $configuration.ingress.Remove('traffic')
    $body = @{
        location = $App.location
        tags = $App.tags
        identity = $App.identity
        properties = @{
            environmentId = $App.properties.environmentId
            configuration = $configuration
            template = $App.properties.template
        }
    }
    try {
        $null = Invoke-Arm $Settings.appId -Method put -Body $body -Sensitive
        $null = Wait-AppProvisioning $Settings.appId
        try { $null = Invoke-Arm "$($Settings.appId)/stop" -Method post }
        finally { $null = Invoke-Arm "$($Settings.appId)/start" -Method post }
        $updated = Wait-AppProvisioning $Settings.appId
        Wait-WebHealth (Get-SiteOrigin $updated)
        return $updated
    }
    finally { $Secrets = $null; $body = $null; $current = $null }
}

function New-PublishClient {
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromMinutes(30)
    return $client
}

function Invoke-PublishRequest {
    param(
        [Parameter(Mandatory)][Net.Http.HttpClient]$Client,
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][string]$Method,
        [string]$Token,
        [IO.Stream]$Stream,
        [string]$ContentType = 'application/octet-stream',
        [int]$TimeoutSeconds = 1800
    )
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::new($Method), $Uri)
    $cancel = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds($TimeoutSeconds))
    try {
        if ($Token) { $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token) }
        if ($Stream) {
            $request.Content = [Net.Http.StreamContent]::new($Stream, 65536)
            $request.Content.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
        }
        return $Client.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead, $cancel.Token).GetAwaiter().GetResult()
    }
    finally {
        $request.Dispose()
        $cancel.Dispose()
    }
}

function Wait-WebHealth {
    param([Parameter(Mandatory)][string]$Origin, [int]$TimeoutSeconds = 600)
    $client = New-PublishClient
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    try {
        do {
            $response = $null
            try {
                $response = Invoke-PublishRequest $client "$Origin/healthz" GET -TimeoutSeconds 30
                if ([int]$response.StatusCode -eq 200) {
                    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json -AsHashtable
                    if ($body['status'] -eq 'ok') { return }
                }
            }
            catch [Net.Http.HttpRequestException], [Threading.Tasks.TaskCanceledException] {
                Write-Warning 'Waiting for HTTPS health after the application restart (connection or timeout).'
            }
            finally { if ($response) { $response.Dispose() } }
            Start-Sleep -Seconds 5
        } while ([DateTime]::UtcNow -lt $deadline)
        throw 'Application did not become healthy after restart.'
    }
    finally { $client.Dispose() }
}

function Wait-PublishDisabled {
    param([Parameter(Mandatory)][string]$Origin, [int]$TimeoutSeconds = 300)
    $client = New-PublishClient
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    try {
        do {
            $disabled = $true
            $health = Invoke-PublishRequest -Client $client -Uri "$Origin/healthz" -Method GET -TimeoutSeconds 60
            try {
                if ([int]$health.StatusCode -ne 200) { $disabled = $false }
                else {
                    $body = $health.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json -AsHashtable
                    if ($body['status'] -ne 'ok') { $disabled = $false }
                }
            }
            finally { $health.Dispose() }
            foreach ($method in @('GET', 'HEAD', 'PUT', 'DELETE')) {
                $response = Invoke-PublishRequest -Client $client -Uri "$Origin/_publish/blobs/lockdown-probe" -Method $method -TimeoutSeconds 60
                try { if ([int]$response.StatusCode -ne 404) { $disabled = $false } }
                finally { $response.Dispose() }
            }
            $response = Invoke-PublishRequest -Client $client -Uri "$Origin/_publish/blobs" -Method GET -TimeoutSeconds 60
            try { if ([int]$response.StatusCode -ne 404) { $disabled = $false } }
            finally { $response.Dispose() }
            if ($disabled) { return }
            Start-Sleep -Seconds 5
        } while ([DateTime]::UtcNow -lt $deadline)
        throw 'Application health and upload-route 404 responses could not both be verified after lockdown.'
    }
    finally { $client.Dispose() }
}

function Disable-Publishing {
    param([Parameter(Mandatory)]$Settings)
    $failure = $null
    try {
        $app = Set-AppVariables $Settings @{ UPLOAD_API_ENABLED = 'false' } -Remove @('UPLOAD_API_TOKEN_SHA256')
        Wait-PublishDisabled (Get-SiteOrigin $app)
    }
    catch { $failure = $_ }
    # Revoke write access even if the app update or HTTP verification fails.
    if ($Settings['contributorAssignmentId']) {
        try {
            $assignments = Invoke-AzJson @('role', 'assignment', 'list', '--scope', $Settings.containerId,
                '--subscription', $Settings.subscriptionId)
            $ownedAssignment = @($assignments | Where-Object { $_.id -eq $Settings.contributorAssignmentId })
            if ($ownedAssignment.Count -gt 0) {
                if ($ownedAssignment[0].principalId -ne $Settings.identityPrincipalId -or
                    -not $ownedAssignment[0].roleDefinitionId.EndsWith("/$script:ContributorRole")) {
                    throw 'Recovery role assignment has an unexpected identity or role. Refusing to delete an unrelated assignment.'
                }
                $null = Invoke-Arm $Settings.contributorAssignmentId -ApiVersion '2022-04-01' -Method delete
                $remaining = Invoke-AzJson @('role', 'assignment', 'list', '--scope', $Settings.containerId,
                    '--subscription', $Settings.subscriptionId)
                if (@($remaining | Where-Object { $_.id -eq $Settings.contributorAssignmentId }).Count) {
                    throw 'Temporary Contributor assignment is still present after deletion.'
                }
            }
        }
        catch {
            if ($failure) { throw "LOCKDOWN FAILED: app disablement and RBAC revocation both failed. Recovery settings retained. $failure ; $_" }
            throw
        }
    }
    if ($failure) { throw $failure }
    Assert-PrivateStorage $Settings
}

function Get-BlobUrlPath {
    param([Parameter(Mandatory)][string]$Name)
    if ($Name -match '[\\\x00-\x1f\x7f]' -or $Name.StartsWith('/') -or $Name.EndsWith('/')) {
        throw 'Blob paths must be relative and cannot contain backslashes or control characters.'
    }
    $segments = $Name.Split('/')
    if (@($segments | Where-Object { $_ -in @('', '.', '..') -or $_ -match '%' }).Count) {
        throw 'Blob paths cannot contain empty, dot, dot-dot or percent-encoded segments.'
    }
    return (($segments | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
}

function Get-PublishListUrl {
    param([Parameter(Mandatory)][string]$Origin, [string]$Prefix = '', [string]$Cursor = '')
    $uri = "$Origin/_publish/blobs?prefix=$([Uri]::EscapeDataString($Prefix))"
    if ($Cursor) { $uri += "&cursor=$([Uri]::EscapeDataString($Cursor))" }
    return $uri
}

function Get-AssetContentType {
    param([Parameter(Mandatory)][string]$Path)
    $types = @{
        '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
        '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json'
        '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
        '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.avif' = 'image/avif'
        '.gif' = 'image/gif'; '.ico' = 'image/x-icon'; '.pdf' = 'application/pdf'
        '.mp3' = 'audio/mpeg'; '.m4a' = 'audio/mp4'; '.wav' = 'audio/wav'
        '.ogg' = 'audio/ogg'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
        '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
    }
    $extension = [IO.Path]::GetExtension($Path).ToLowerInvariant()
    if (-not $types.ContainsKey($extension)) { throw "Unsupported site asset extension '$extension'; choose content explicitly rather than uploading a source tree." }
    return $types[$extension]
}
