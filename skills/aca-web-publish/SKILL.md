---
name: aca-web-publish
description: Publish a website, HTML report, or media-rich static application on Azure Container Apps Express with private Blob Storage. Use for Azure web publishing, sharing generated HTML, image or audio libraries, and small authenticated sites. Defaults to Sweden Central, Cool-tier Blob storage, HTTP scale-to-zero, one maximum replica, and application-level GitHub, Google, or Entra allowlists. Includes a temporary authenticated upload relay so Storage public networking never needs to be enabled.
license: MIT
---

# Publish a private-Blob website on ACA Express

Deploy a small application container that authenticates readers and streams site
assets from Blob Storage. Keep HTML, images, audio and other large content out of
the container image. The browser talks only to the application; the application
reaches Blob through a VNet and a private endpoint.

## Non-negotiables

- Use **Container Apps Express**, not standard Container Apps. Verify the deployed
  environment reports `environmentMode: Express`; a similar-looking Consumption
  configuration is not a substitute.
- Default to `swedencentral`. Check the current
  [Express capability matrix](https://learn.microsoft.com/azure/container-apps/express-overview)
  and actual regional API support before changing region.
- Storage public networking is **disabled at creation and stays disabled**.
  Never open a firewall window to upload, even briefly.
- Disable anonymous Blob access and shared-key access. Use OAuth with a
  **user-assigned** managed identity; Express does not support system-assigned
  identity.
- Create a Blob private endpoint, the `privatelink.blob.core.windows.net` private
  DNS zone, and its VNet link. Verify approval, private resolution and actual
  application-to-Blob access.
- Use **Cool** storage, including an explicit Cool tier on uploaded/overwritten
  blobs. Explain retrieval and minimum-retention charges for frequently edited
  or downloaded material; cheap capacity does not mean cheap access.
- Configure HTTP scaling with minimum **0**, maximum **1** replica. HTTP
  concurrency is a scaling target, not a guarantee of request capacity.
- Authenticate readers in the application using GitHub, Google or single-tenant
  Entra plus an explicit allowlist. Empty allowlists deny everyone.
- Enable anonymous reader mode only with explicit permission for public content.
  Private Blob networking alone does not make an anonymously served website
  private.
- Keep the upload API **disabled by default**. When disabled, every management
  route returns 404 before authentication or Storage access.
- Never put credentials, provider tokens, local deployment settings, private
  source documents or real user identifiers in the published skill/example.

## Decide before deploying

Confirm the subscription, dedicated resource group, content directory and who
may read the site. Explain the resources and ongoing charges: Express compute,
ACR, private endpoint, private DNS, Storage and retrieval/transfer. Scale-to-zero
applies to application replicas, not the whole resource group's bill.

Ask for explicit authorization before creating cloud resources, granting roles,
creating identity-provider registrations or publishing private material. A request
for a diagram or local HTML file does not authorize deployment.

Use the generated HTTPS `azurecontainerapps.io` hostname. Express currently does
not support custom domains or Easy Auth. Do not silently add a gateway, change
hosting models or substitute platform authentication. If a required Express
feature is unavailable, report the conflict and ask for direction.

## Architecture and implementation

Use the supplied assets rather than inventing another proxy:

- `assets/infra/main.bicep`: Express environment, delegated VNet subnet, private
  Blob endpoint/DNS, Cool account and private container, ACR and user identity.
- `assets/infra/app.bicep`: one web container, identity-based ACR pulls, HTTP
  min-0/max-1 scaling, health probes and upload-disabled defaults.
- `assets/app`: streaming reader/upload server, OAuth/OIDC and focused tests.
- `assets/scripts`: PowerShell 7 deployment, authentication, publishing and
  recovery commands. [README](README.md) gives the entry points.

The templates target public Azure. They use an ARM API that exposes
`environmentMode`; an older Bicep type catalog may warn that it cannot statically
validate that resource type. Compile, deploy and inspect the actual result.
Do not treat a successful compile as proof of Express support.

The scripts preserve the full application configuration on update, then use
Express's **application stop/start** operations to apply environment/secret
changes. This causes a brief interruption with one replica. In the exercised
preview, an ARM update could report success while the running process retained
old values; standard revision-restart tooling also failed. Verify the actual
HTTP behavior after each change rather than trusting the control-plane state.

The website has public HTTPS ingress, but Blob does not. The steady-state
identity has container-scoped **Storage Blob Data Reader**, plus **AcrPull** on
the registry. Do not give the application account-wide Contributor or storage
keys. Creation of the Blob container uses the management plane, not a public
data-plane upload.

## Deployment sequence

1. Inspect installed Azure CLI/Bicep and the effective approved package feed.
   Check compatible versions in that feed, preserve the supplied dependency
   lock, and resolve there. Never bypass a managed feed or quarantine.
2. Deploy the foundation to the authorized dedicated resource group. Inspect
   the Express mode, VNet subnet, endpoint approval, private DNS link and Storage
   flags before deploying or publishing content.
3. Build the code-only container in ACR with the approved package index. A local
   Docker daemon is not required. Do not upload the website, secrets or unrelated
   repository files as part of the build context.
4. Deploy an empty, explicitly authorized anonymous bootstrap. Discover the
   **actual returned HTTPS origin**, then configure it as `PUBLIC_BASE_URL`.
   Do not guess or register placeholder OAuth callback URLs.
5. Register/configure the chosen reader provider at
   `<actual-origin>/oauth/<provider>/callback`, then set the provider credentials
   and explicit allowlist. The authentication script rotates the session key.
   Configure authentication **before** uploading private content.
6. Publish through the temporary relay, then verify the closed state. Do not
   substitute direct Blob uploads from a public workstation.
7. Verify the deployed site, not only the local server or ARM configuration.

## Reader authentication

Match the provider's returned identity, never a name supplied by the browser.
Use comma-separated `ALLOWED_USERS`: prefer `github:<numeric-id>`,
`google:<sub>` or `entra:<oid>` to email/usernames when practical. See the
[runtime contract](assets/app/README.md) for provider-specific env variables
and the supported email/username alternatives.

- **GitHub:** authorization-code flow, state, and a server-side identity lookup.
- **Google:** verified OIDC signature, issuer, audience, nonce and state;
  email-based authorization requires a verified email.
- **Entra:** tenant-specific OIDC issuer, validated token and tenant, audience,
  nonce and state. Do not use `common` as a shortcut for a single-tenant site.

Keep only a minimal signed, Secure, HttpOnly, SameSite session cookie; never put
provider access/refresh tokens in it. Recheck the current allowlist on requests.
Protect every reader route, including images, audio, HEAD and byte ranges.
Health checks are public but contain no credentials or internal diagnostics.
Reader sessions never grant publishing permission.

Do not declare login verified from an authorization redirect alone. Test a real
allowed account and a denied account when available. Hand off interactive
credentials/MFA to the user; report any untested path precisely.

## Temporary publishing contract

The relay supports list, read/HEAD, create/overwrite and delete:

| Method and route | Meaning |
| --- | --- |
| `GET /_publish/blobs?prefix=...&cursor=...` | One page of blob metadata |
| `GET` or `HEAD /_publish/blobs/<path>` | Read or inspect one exact object |
| `PUT /_publish/blobs/<path>` | Stream a complete create/overwrite |
| `DELETE /_publish/blobs/<path>` | Delete one exact object |

Follow returned pagination cursors. Scope all requests to the configured
container. Reject traversal, backslashes, controls and ambiguous paths; never
accept arbitrary upstream URLs/accounts/containers.

For each publishing operation:

1. Take the local publishing lock. Recover a previous interrupted run first;
   serialize deployments/publishing across operators as well.
2. Persist a **nonsecret recovery marker** containing the app, container,
   identity and exact temporary role-assignment IDs.
3. Generate a fresh cryptographically random bearer token. Keep its plaintext
   only in the publisher's memory; put **only its SHA-256 digest** in
   `UPLOAD_API_TOKEN_SHA256`.
4. Temporarily grant container-scoped **Storage Blob Data Contributor** and
   enable the API. Apply the changed environment with application stop/start,
   then wait for health, the new configuration and RBAC propagation using bounded
   probes/retries.
5. Stream HTTPS uploads without following redirects. Enforce a finite actual
   byte limit even when Content-Length is missing or false. Commit only complete
   block blobs; interruptions must not replace the previous version.
6. In `finally`, disable the API and remove its digest **first**, verify 404 on
   every management method, then revoke the exact temporary Contributor
   assignment. Revoke write access even if application lockdown fails.
7. Retain the recovery marker and fail loudly if any lockdown step cannot be
   verified. An interrupted process cannot guarantee `finally` ran.

Do not log bearer tokens or save them in source, command-line arguments or state
files. Rotate a fresh token each run; a reader cookie is not an upload key.
Never recursively delete/synchronize a container by default. Publish from a
dedicated site directory; reject hidden files, links and accidental source
trees. Multi-file publication is not transactional: use versioned asset names
and publish entry-point HTML last.

## Evidence required for completion

Inspect both control plane and data plane:

- Environment really is Express, correct region and VNet integration.
- Storage remains network-disabled, key-disabled and non-anonymous; endpoint
  and private DNS are correct.
- The application can list/read/upload through its identity and private network,
  while the public Blob path cannot serve the content.
- HTML and a separately stored image render through the website. For audio or
  other large media, verify HEAD, valid single-range 206 and invalid-range 416.
- Enabled upload API rejects missing/invalid tokens; disabled API returns 404
  for list, GET, HEAD, PUT and DELETE. Overwrite, exact delete and list paging
  work. Failed/oversized/interrupted uploads preserve committed content.
- Authenticated mode protects all assets, permits an allowlisted identity and
  rejects a non-allowlisted one. Distinguish mock tests from live login evidence.
- Each published blob is Cool; only Reader remains after publishing.
- ARM scaling configuration is min 0/max 1 with an HTTP rule. Observe idle
  replica behavior if claiming an actual scale-to-zero result.

Keep a concise outcome: site URL, reader mode, what was verified, what requires
user action, and resources/costs left behind. Do not delete the resource group
or identity registration without explicit approval.
