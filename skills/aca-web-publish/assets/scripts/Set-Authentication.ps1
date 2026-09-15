#requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SettingsPath,
    [Parameter(Mandatory)][ValidateSet('github', 'google', 'entra')][string]$Provider,
    [Parameter(Mandatory)][string]$ClientId,
    [Parameter(Mandatory)][securestring]$ClientSecret,
    [Parameter(Mandatory)][string]$AllowedUsers,
    [string]$TenantId = ''
)
. "$PSScriptRoot\Common.ps1"
if ([string]::IsNullOrWhiteSpace($AllowedUsers)) { throw 'Provide at least one explicit allowed identity.' }
if ($Provider -eq 'entra' -and $TenantId -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Entra requires the specific tenant GUID, not common or organizations.' }
$lock = [IO.File]::Open("$([IO.Path]::GetFullPath($SettingsPath)).lock", [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
    $settings = Read-PublishSettings $SettingsPath
    if ($settings['publishingMayBeEnabled']) { throw 'Recover the interrupted publishing run with -Action Lockdown before changing authentication.' }
    Assert-PrivateStorage $settings
    $app = Invoke-Arm $settings.appId
    $origin = Get-SiteOrigin $app
    $oldSecrets = Invoke-Arm "$($settings.appId)/listSecrets" -Method post -Sensitive
    $secrets = @($oldSecrets.value | Where-Object { $_.name -notin @('session', 'oauth-client') })
    $secrets += @{ name = 'session'; value = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
    $secrets += @{ name = 'oauth-client'; value = ConvertFrom-SecureString $ClientSecret -AsPlainText }
    $names = @('AUTH_PROVIDER', 'ALLOWED_USERS', 'PUBLIC_BASE_URL', 'ENTRA_TENANT_ID',
        'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
        'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'UPLOAD_API_ENABLED', 'UPLOAD_API_TOKEN_SHA256')
    $variables = @($app.properties.template.containers[0].env | Where-Object { $_.name -notin $names })
    $variables += @(
        @{ name = 'AUTH_PROVIDER'; value = $Provider }
        @{ name = 'ALLOWED_USERS'; value = $AllowedUsers }
        @{ name = 'PUBLIC_BASE_URL'; value = $origin }
        @{ name = 'ENTRA_TENANT_ID'; value = $TenantId }
        @{ name = 'UPLOAD_API_ENABLED'; value = 'false' }
        @{ name = "$($Provider.ToUpperInvariant())_CLIENT_ID"; value = $ClientId }
        @{ name = "$($Provider.ToUpperInvariant())_CLIENT_SECRET"; secretRef = 'oauth-client' }
    )
    $app.properties.template.containers[0].env = $variables
    $null = Save-WebApp $settings $app -Secrets $secrets
    Wait-PublishDisabled $origin
    Write-Host "Configured $Provider and its explicit allowlist. Callback: $origin/oauth/$Provider/callback"
    Write-Host 'Complete real browser login, allowed-user, and denied-user checks before calling authentication verified.'
}
finally {
    $secrets = $null
    $oldSecrets = $null
    $lock.Dispose()
}
