#requires -Version 7.4
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\Common.ps1"

function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ($Actual -cne $Expected) { throw "$Message -- expected '$Expected', got '$Actual'." }
}
function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $threw = $false
    try { & $Action }
    catch { $threw = $true }
    if (-not $threw) { throw $Message }
}

foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1') {
    $errors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$errors)
    if ($errors) { throw ($errors | Out-String) }
}
foreach ($command in @(
    @{ file = 'Publish-Content.ps1'; arguments = @{ Action = 'List' } }
    @{ file = 'Set-Authentication.ps1'; arguments = @{
        Provider = 'github'; ClientId = 'fictional-client'
        ClientSecret = ConvertTo-SecureString 'fictional-test-secret' -AsPlainText -Force
        AllowedUsers = 'github:123'
    } }
)) {
    $invalidSettings = [IO.Path]::GetTempFileName()
    $lockPath = "$invalidSettings.lock"
    try {
        [IO.File]::WriteAllText($invalidSettings, '{invalid-json')
        $arguments = $command.arguments
        Assert-Throws { & (Join-Path $PSScriptRoot $command.file) -SettingsPath $invalidSettings @arguments } 'Invalid settings accepted'
        Assert-Equal (Test-Path -LiteralPath $lockPath) $true 'Settings read only after acquiring the lock'
        $released = [IO.File]::Open($lockPath, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $released.Dispose()
    }
    finally {
        Remove-Item -LiteralPath $invalidSettings -Force
        if (Test-Path -LiteralPath $lockPath) { Remove-Item -LiteralPath $lockPath -Force }
    }
}
Assert-Equal (Get-BlobUrlPath 'images/blue diagram.svg') 'images/blue%20diagram.svg' 'Escape each segment'
foreach ($path in @('../x', 'x/../y', '/x', 'x/', 'x//y', 'x\y', 'x/%2e', "x/`ny")) {
    Assert-Throws { Get-BlobUrlPath $path } "Unsafe path accepted: $path"
}
Assert-Equal (Get-AssetContentType 'index.html') 'text/html; charset=utf-8' 'HTML MIME'
Assert-Equal (Get-AssetContentType 'sound.mp3') 'audio/mpeg' 'Audio MIME'
Assert-Throws { Get-AssetContentType '.env' } 'Hidden credentials accepted'
Assert-Throws { Get-AssetContentType 'main.py' } 'Source code accepted'
Assert-Equal (Get-PublishListUrl 'https://example.test' 'images/') 'https://example.test/_publish/blobs?prefix=images%2F' 'Initial list omits empty cursor'
Assert-Equal (Get-PublishListUrl 'https://example.test' '' 'signed+cursor') 'https://example.test/_publish/blobs?prefix=&cursor=signed%2Bcursor' 'Continuation is escaped'
$path = Write-PrivateJson @{ secret = 'fictional-test-value' }
try {
    Assert-Equal (Get-Content $path -Raw | ConvertFrom-Json).secret 'fictional-test-value' 'Private JSON round trip'
}
finally { Remove-Item -LiteralPath $path }

$script:fakeApp = @{
    location = 'swedencentral'
    tags = @{ purpose = 'test' }
    identity = @{ type = 'UserAssigned'; userAssignedIdentities = @{ '/test-identity' = @{} } }
    properties = @{
        environmentId = '/test-environment'
        template = @{
            revisionSuffix = 'old'
            containers = @(@{
                name = 'web'
                env = @(
                    @{ name = 'SESSION_SECRET'; secretRef = 'session' }
                    @{ name = 'UPLOAD_API_TOKEN_SHA256'; value = 'old-digest' }
                    @{ name = 'UPLOAD_API_ENABLED'; value = 'true' }
                    @{ name = 'ALLOWED_USERS'; value = 'keep-this' }
                )
            })
        }
        configuration = @{ ingress = @{ fqdn = 'sample.test.azurecontainerapps.io'; external = $true } }
    }
}
$script:patch = $null
$script:updateEvents = [Collections.Generic.List[string]]::new()
$script:failStop = $false
function Invoke-Arm { param($ResourceId, $ApiVersion, $Method = 'get', $Body, [switch]$Sensitive)
    if ($ResourceId.EndsWith('/stop')) {
        $script:updateEvents.Add('stop')
        if ($script:failStop) { throw 'Simulated stop failure' }
        return
    }
    if ($ResourceId.EndsWith('/start')) { $script:updateEvents.Add('start'); return }
    if ($Method -eq 'put') {
        $script:updateEvents.Add('put')
        $script:patch = $Body | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
        return
    }
    if ($Method -eq 'post') { return @{ value = @(@{ name = 'session'; value = 'fictional-test-secret' }) } }
    return $script:fakeApp
}
function Wait-AppProvisioning { param($AppId)
    $script:fakeApp.properties.configuration.ingress.fqdn = 'sample.test.azurecontainerapps.io'
    return $script:fakeApp
}
function Wait-WebHealth { param($Origin) Assert-Equal $Origin 'https://sample.test.azurecontainerapps.io' 'Restart health origin' }
$settings = @{ appId = '/fictional-app' }
$null = Set-AppVariables $settings @{ UPLOAD_API_ENABLED = 'false' } -Remove @('UPLOAD_API_TOKEN_SHA256')
$variables = $script:patch.properties.template.containers[0].env
Assert-Equal @($variables | Where-Object name -eq 'UPLOAD_API_TOKEN_SHA256').Count 0 'Digest removed'
Assert-Equal ($variables | Where-Object name -eq 'SESSION_SECRET').secretRef 'session' 'Secret reference preserved'
Assert-Equal ($variables | Where-Object name -eq 'ALLOWED_USERS').value 'keep-this' 'Reader configuration preserved'
Assert-Equal ($variables | Where-Object name -eq 'UPLOAD_API_ENABLED').value 'false' 'API disabled'
Assert-Equal $script:patch.properties.template.ContainsKey('revisionSuffix') $false 'Old revision suffix removed'
Assert-Equal $script:patch.identity.type 'UserAssigned' 'Identity preserved by full update'
Assert-Equal $script:patch.properties.configuration.secrets[0].value 'fictional-test-secret' 'Existing secret preserved'
Assert-Equal $script:patch.properties.configuration.ingress.ContainsKey('fqdn') $false 'Read-only hostname omitted'
Assert-Equal ($script:updateEvents -join ',') 'put,stop,start' 'Express update activation'
$script:updateEvents.Clear()
$script:failStop = $true
Assert-Throws { Save-WebApp $settings $script:fakeApp } 'Failed stop reported success'
Assert-Equal ($script:updateEvents -join ',') 'put,stop,start' 'Start still attempted after failed stop'
$script:failStop = $false
$script:fakeApp.properties.configuration.ingress.fqdn = 'sample.test.azurecontainerapps.io'

$script:events = [Collections.Generic.List[string]]::new()
$script:failDisable = $false
$script:deleted = $false
function Set-AppVariables { param($Settings, $Variables, $Remove)
    $script:events.Add('disable')
    return $script:fakeApp
}
function Wait-PublishDisabled { param($Origin)
    $script:events.Add('verify')
    if ($script:failDisable) { throw 'Simulated disable verification failure' }
}
function Invoke-AzJson { param($Arguments)
    if (-not $script:deleted) {
        return @(@{ id = 'assignment'; principalId = 'principal'; roleDefinitionId = "/$script:ContributorRole" })
    }
    return @()
}
function Invoke-Arm { param($ResourceId, $ApiVersion, $Method)
    Assert-Equal $Method 'delete' 'Only delete the owned role'
    $script:events.Add('revoke')
    $script:deleted = $true
}
function Assert-PrivateStorage { param($Settings) $script:events.Add('storage') }
$settings = @{ appId = 'app'; contributorAssignmentId = 'assignment'; containerId = 'container'
    subscriptionId = 'subscription'; identityPrincipalId = 'principal' }
Disable-Publishing $settings
Assert-Equal ($script:events -join ',') 'disable,verify,revoke,storage' 'Normal lockdown order'
$script:events.Clear()
$script:deleted = $false
$script:failDisable = $true
Assert-Throws { Disable-Publishing $settings } 'Failed lockdown reported success'
Assert-Equal ($script:events -join ',') 'disable,verify,revoke' 'RBAC revocation still runs after failure'

Write-Output 'Publisher helper tests passed: parsing, paths, MIME, JSON, env preservation, lockdown and failure recovery.'
