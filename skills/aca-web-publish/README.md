# ACA web publish

Serve a media-rich website on **Azure Container Apps Express** while its HTML,
images and audio stay in **private Cool-tier Blob Storage**. The application
handles GitHub, Google or Entra login with an explicit allowlist. A temporary
authenticated upload relay publishes content without ever opening Storage's
public network.

[Skill instructions](SKILL.md) | [Example site and deployment evidence](../../examples/aca-web-publish/README.md)

## Use

```text
Publish this site on ACA Express in Sweden Central. Keep all content in private
Cool-tier Blob Storage, use a VNet/private endpoint, and scale on HTTP from zero
to at most one replica. Require Entra login for this explicit allowlist. Publish
through the temporary upload API and verify that it is disabled afterward.
```

Requires Azure deployment/RBAC permissions, PowerShell 7.4+, Azure CLI, Bicep,
an approved Python package feed reachable by ACR builds, and permission to
configure the selected identity provider. Express is a preview service; check
its [current capabilities](https://learn.microsoft.com/azure/container-apps/express-overview).
No local Docker daemon is necessary.

## Included commands

Run from the installed skill directory. Use a dedicated resource group and
settings path. The first deployment contains **no site content** and explicitly
requires authorization for anonymous bootstrap:

```powershell
.\assets\scripts\Deploy-Express.ps1 `
  -SubscriptionId '<subscription-guid>' -ResourceGroup 'rg-my-site' `
  -Prefix 'my-site' -PackageIndexUrl 'https://<approved-feed>/simple/' `
  -SettingsPath '.aca-publish.json' -AllowAnonymousBootstrap
```

The script records the build log beside the settings file and deploys an image
by its verified digest. If interrupted before app creation, reuse a completed
foundation with `-ExistingFoundationDeployment '<deployment-name>'` and/or an
already-built `-ExistingImageTag 'web:<tag>'`; parameters and resources are
checked again. `-UseExistingResourceGroup` explicitly authorizes the dedicated
group's reuse. Existing applications are never reset to anonymous mode.

Create an OAuth/OIDC registration using the returned site origin and
`/oauth/github/callback`, `/oauth/google/callback` or `/oauth/entra/callback`.
Never use a guessed callback. Pass the secret without placing it in shell
history:

```powershell
$secret = Read-Host 'Provider client secret' -AsSecureString
.\assets\scripts\Set-Authentication.ps1 `
  -SettingsPath '.aca-publish.json' -Provider entra `
  -ClientId '<application-client-id>' -ClientSecret $secret `
  -TenantId '<tenant-guid>' -AllowedUsers 'entra:<user-object-id>'
$secret = $null
```

Prefer immutable allowlist identities: `github:<numeric-id>`, `google:<sub>`,
or `entra:<oid>`. Alternatives are GitHub login, Google verified email, or a
validated Entra username/email. See the [runtime contract](assets/app/README.md).
Changing authentication rotates the session key and signs existing readers out.
Provider setup and real browser login remain separate from deployment.
Rotate the provider credential before its configured expiry using the same
authentication command; never commit or retain plaintext credentials in settings.

Environment/secret changes use full configuration-preserving updates followed
by Express application stop/start. Expect a brief interruption when publishing
opens/closes or authentication changes; this is not a zero-downtime workflow.
The scripts verify real health and route behavior because a successful ARM
update did not reliably refresh running processes in the exercised preview.

Publish a dedicated output directory, not a project checkout:

```powershell
.\assets\scripts\Publish-Content.ps1 `
  -SettingsPath '.aca-publish.json' -Action Upload -Source '.\site'
```

Anonymous sites additionally require `-AllowAnonymous` on each publishing
operation. Other actions are `Put` (`-Source`, `-Blob`), `Get` (`-Blob`,
`-OutputPath`), `Head`/`Delete` (`-Blob`), and `List` (`-Prefix`, `-Cursor`).
List returns `items` and `next_cursor` (up to 100 items); pass a non-null cursor
unchanged with the same prefix for the next page. Cursors expire after 24 hours.
Delete targets one exact object; there is no recursive delete or implicit mirror.

After a terminated session or any uncertain cleanup, run:

```powershell
.\assets\scripts\Publish-Content.ps1 `
  -SettingsPath '.aca-publish.json' -Action Lockdown
```

Keep this nonsecret settings file until the deployment is retired. It contains
recovery coordinates and must not be published. Serialize operators: the local
lock prevents concurrent runs using one file, not distributed publishers.

## Defaults and boundaries

| Concern | Contract |
| --- | --- |
| Hosting | Express, Sweden Central, HTTPS generated domain |
| Scaling | HTTP, min 0 / max 1; not a throughput guarantee |
| Content | Private Blob endpoint + DNS, Cool tier, no anonymous/shared-key access |
| Runtime identity | User-assigned; container-scoped Reader, registry-scoped AcrPull |
| Publishing | Fresh ephemeral bearer token, digest only in ACA, temporary container-scoped Contributor |
| Reader auth | Application-level GitHub, Google or single-tenant Entra; explicit allowlist |
| Limitations | No Express custom domain or Easy Auth; no multi-file transaction |

Zero idle replicas do **not** mean zero total cost. ACR, private endpoints, DNS,
Blob capacity, retrieval and transfer can still incur charges. Cool has
minimum-retention/early-deletion considerations. Do not delete the deployment
or identity-provider registration without approval.

The Python runtime carries focused tests; deployment scripts still require
live Azure checks for Express behavior, private connectivity, RBAC propagation
and provider login. See the example for the evidence actually obtained, rather
than treating deployment configuration as an end-to-end test.
