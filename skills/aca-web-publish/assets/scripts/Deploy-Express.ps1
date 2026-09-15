#requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory)][guid]$SubscriptionId,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')][string]$Prefix,
    [string]$Location = 'swedencentral',
    [string]$StorageAccountName,
    [string]$RegistryName,
    [string]$ContainerName = 'site',
    [string]$SettingsPath = '.aca-publish.json',
    [string]$ExistingImageTag,
    [string]$ExistingFoundationDeployment,
    [Parameter(Mandatory)][uri]$PackageIndexUrl,
    [switch]$UseExistingResourceGroup,
    [switch]$AllowAnonymousBootstrap
)
. "$PSScriptRoot\Common.ps1"
if (-not $AllowAnonymousBootstrap) {
    throw 'First deployment exposes an empty anonymous site. Explicit -AllowAnonymousBootstrap is required; configure reader auth before uploading private content.'
}
if ($PackageIndexUrl.Scheme -ne 'https' -or $PackageIndexUrl.UserInfo -or $PackageIndexUrl.Query -or $PackageIndexUrl.Fragment) {
    throw 'Use an approved HTTPS package feed without credentials embedded in its URL.'
}
if (Test-Path -LiteralPath $SettingsPath) { throw 'Settings file already exists. Use the existing deployment; this script creates a new app.' }
$account = Invoke-AzJson @('account', 'show', '--subscription', "$SubscriptionId")
if ($account.environmentName -ne 'AzureCloud') { throw 'These templates target public Azure, not sovereign clouds.' }
$suffix = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData(
    [Text.Encoding]::UTF8.GetBytes("$SubscriptionId/$ResourceGroup/$Prefix"))).Substring(0, 16).ToLowerInvariant()
if (-not $StorageAccountName) { $StorageAccountName = "st$suffix" }
if (-not $RegistryName) { $RegistryName = "acr$suffix" }
$exists = Invoke-AzJson @('group', 'exists', '--name', $ResourceGroup, '--subscription', "$SubscriptionId")
if ($exists -and -not $UseExistingResourceGroup) { throw 'Resource group exists; use a dedicated new group or explicitly authorize reuse.' }
if (-not $exists) {
    $null = Invoke-AzJson @('group', 'create', '--name', $ResourceGroup, '--location', $Location,
        '--subscription', "$SubscriptionId", '--tags', 'purpose=aca-web-publish')
}
$resources = @(Invoke-AzJson @('resource', 'list', '--resource-group', $ResourceGroup, '--subscription', "$SubscriptionId"))
if (@($resources | Where-Object { $_.type -eq 'Microsoft.App/containerApps' -and $_.name -eq $Prefix }).Count) {
    throw 'The app already exists; refusing to reset its authentication or secrets.'
}
$existingStorage = @($resources | Where-Object { $_.type -eq 'Microsoft.Storage/storageAccounts' -and $_.name -eq $StorageAccountName })
if ($existingStorage.Count) { Assert-PrivateStorage @{ storageId = $existingStorage[0].id } }
$deploymentSuffix = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
if ($ExistingFoundationDeployment) {
    Write-Host 'Reading and verifying the existing foundation deployment...'
    $foundation = Invoke-AzJson @('deployment', 'group', 'show', '--name', $ExistingFoundationDeployment,
        '--resource-group', $ResourceGroup, '--subscription', "$SubscriptionId")
    foreach ($entry in @{ prefix = $Prefix; storageAccountName = $StorageAccountName; registryName = $RegistryName
        location = $Location; containerName = $ContainerName }.GetEnumerator()) {
        if ($foundation.properties.parameters[$entry.Key].value -ne $entry.Value) {
            throw "Existing foundation parameter '$($entry.Key)' does not match the requested deployment."
        }
    }
}
else {
    Write-Host 'Deploying the Express environment and private Blob foundation...'
    $foundation = Invoke-AzJson @('deployment', 'group', 'create', '--name', "$Prefix-foundation-$deploymentSuffix",
        '--resource-group', $ResourceGroup, '--subscription', "$SubscriptionId",
        '--template-file', (Join-Path $PSScriptRoot '..' 'infra' 'main.bicep'), '--parameters',
        "location=$Location", "prefix=$Prefix", "storageAccountName=$StorageAccountName",
        "registryName=$RegistryName", "containerName=$ContainerName")
}
if ($foundation.properties.provisioningState -ne 'Succeeded') { throw 'Foundation deployment did not succeed.' }
$out = $foundation.properties.outputs
$environment = Invoke-Arm $out.environmentId.value
if ($environment.properties.environmentMode -ne 'Express' -or -not $environment.properties.vnetConfiguration.infrastructureSubnetId) {
    throw 'Express with VNet integration was not provisioned. Do not fall back to standard ACA or public Blob networking.'
}
$settings = @{
    subscriptionId = "$SubscriptionId"; resourceGroup = $ResourceGroup; location = $Location
    appId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.App/containerApps/$Prefix"
    environmentId = $out.environmentId.value
    storageId = $out.storageId.value; containerId = $out.containerId.value
    identityId = $out.identityId.value; identityPrincipalId = $out.identityPrincipalId.value
    registryName = $RegistryName; publishingMayBeEnabled = $false
}
Assert-PrivateStorage $settings
$imageTag = $ExistingImageTag
if ($imageTag -and $imageTag -notmatch '^web:[a-zA-Z0-9_.-]+$') { throw 'Existing image must be a web:<tag> in this deployment''s registry.' }
if (-not $imageTag) {
    $imageTag = "web:$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
    $buildLog = "$([IO.Path]::GetFullPath($SettingsPath)).build.log"
    Write-Host "Building the code-only container in ACR. Log: $buildLog"
    Invoke-AzureCli @('acr', 'build', '--registry', $RegistryName, '--subscription', "$SubscriptionId",
        '--image', $imageTag, '--platform', 'linux/amd64', '--build-arg', "PIP_INDEX_URL=$PackageIndexUrl",
        '--no-format', '--only-show-errors', (Join-Path $PSScriptRoot '..' 'app')) *> $buildLog
    if ($script:AzExitCode -ne 0) {
        throw "ACR build failed (exit $script:AzExitCode). Inspect $buildLog; never switch to an unapproved feed."
    }
}
$manifest = Invoke-AzJson @('acr', 'repository', 'show', '--name', $RegistryName,
    '--subscription', "$SubscriptionId", '--image', $imageTag)
if (-not $manifest.digest) { throw 'Built image digest could not be verified.' }
$image = "$($out.registryServer.value)/web@$($manifest.digest)"
$parameters = @{
    '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters = @{}
}
$values = @{
    location = $Location; appName = $Prefix; environmentId = $out.environmentId.value
    identityId = $out.identityId.value; identityClientId = $out.identityClientId.value
    image = $image; registryServer = $out.registryServer.value; storageAccountName = $StorageAccountName
    containerName = $ContainerName; authProvider = 'none'
    sessionSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}
foreach ($entry in $values.GetEnumerator()) { $parameters.parameters[$entry.Key] = @{ value = $entry.Value } }
$parameterPath = Write-PrivateJson $parameters
try {
    Write-Host 'Deploying the empty web application...'
    $deployment = Invoke-AzJson -Sensitive -Arguments @('deployment', 'group', 'create', '--name', "$Prefix-app-$deploymentSuffix",
        '--resource-group', $ResourceGroup, '--subscription', "$SubscriptionId",
        '--template-file', (Join-Path $PSScriptRoot '..' 'infra' 'app.bicep'), '--parameters', "@$parameterPath")
}
finally {
    Remove-Item -LiteralPath $parameterPath -Force
    $values.sessionSecret = $null
    $parameters.parameters.sessionSecret.value = $null
}
if ($deployment.properties.provisioningState -ne 'Succeeded') { throw 'App deployment did not succeed.' }
$app = Invoke-Arm $settings.appId
$origin = Get-SiteOrigin $app
$settings.origin = $origin
$settings.image = $image
# Save recovery coordinates before making further app updates.
$settings | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $SettingsPath -Encoding utf8
$null = Set-AppVariables $settings @{ PUBLIC_BASE_URL = $origin }
Wait-PublishDisabled $origin
Write-Host "Empty site: $origin"
Write-Host "Settings: $([IO.Path]::GetFullPath($SettingsPath))"
Write-Host 'Reader mode is anonymous. Configure authentication before publishing private content.'
