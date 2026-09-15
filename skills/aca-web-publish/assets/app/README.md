# ACA web publishing runtime

FastAPI/uvicorn streams site content from one private Blob container using a
user-assigned managed identity (UAMI). The image contains no site HTML, images,
or audio. Reader authentication is app-level OAuth/OIDC, not ACA EasyAuth.

## Dependencies, build, and tests

Use Python 3.13 in an isolated environment outside the Docker build context.
`requirements.in` declares direct pins; `requirements.txt` is the fully resolved
39-package version lock, including transitive dependencies. Install the lock,
not unpinned upgrades. Inspect effective package configuration and use the
approved feed without a public-index fallback.

From this directory, with the isolated environment activated:

```text
python -m pip config debug
python -m pip install --index-url https://packagefeedproxy.microsoft.io/pypi/simple/ -r requirements.txt
python -m pip check
python -m unittest discover -s tests -q
```

Tests use in-memory/mocked storage and identity providers, plus local HTTP;
they require no Azure credentials and perform no Azure writes.

Docker build context is this directory. The required `PIP_INDEX_URL` build
argument must name the approved feed above. The image runs as UID/GID
`10001:10001` on port 8000; test files and this README are excluded. Entrypoint:

```text
uvicorn app:create_app --factory --host 0.0.0.0 --port 8000 --no-access-log --no-proxy-headers
```

## Environment

| Variable | Requirement or default |
| --- | --- |
| `STORAGE_ACCOUNT_NAME` | Required storage account name, not a URL. |
| `BLOB_CONTAINER_NAME` | Default `site`; all operations stay in this container. |
| `AZURE_CLIENT_ID` | Required UAMI client UUID; no system-assigned identity fallback. |
| `SESSION_SECRET` | Required random secret of at least 32 bytes, even in anonymous mode. |
| `AUTH_PROVIDER` | Default `github`; allowed values: `none`, `github`, `google`, `entra`. |
| `PUBLIC_BASE_URL` | Explicit canonical HTTPS origin. Missing/empty is permitted only with explicit `AUTH_PROVIDER=none` for ingress bootstrap. |
| `ALLOWED_USERS` | Comma-separated allowlist; empty denies every authenticated reader. Ignored only in explicit anonymous mode. |
| `UPLOAD_API_ENABLED` | Default `false`; accepts `true` or `false`. |
| `UPLOAD_API_TOKEN_SHA256` | Required when publishing is enabled: exactly 64 hex characters containing the bearer token's SHA-256 digest. Never store the plaintext token here. |
| `MAX_UPLOAD_BYTES` | Default `1073741824` (1 GiB); integer from `1` through `209715200000`, never unlimited. |
| `LOCAL_DEV` | Default `false`; `true` permits an explicit HTTP origin only on `localhost`, `127.0.0.1`, or `::1`. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Required when using GitHub. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Required when using Google. |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | Required when using Entra; tenant and client IDs must be UUIDs, not multi-tenant aliases. |

Bootstrap is intentionally public when `AUTH_PROVIDER=none`; it does not imply
publishing access. Set the returned HTTPS ingress origin and complete provider
configuration before enabling authentication. Origins are never inferred from
Host/forwarded headers. Invalid or incomplete required configuration prevents
startup.

## Reader identities and sessions

Allowlist entries match exactly after casefolding; wildcards are not supported.
Prefer immutable identity entries over changeable names:

| Provider | Preferred entry | Optional plain-name entry |
| --- | --- | --- |
| GitHub | `github:<numeric-user-id>` | Server-fetched GitHub login, not email. |
| Google | `google:<sub>` | Email only when the validated ID token has `email_verified=true`. |
| Entra | `entra:<oid>` | Validated `preferred_username`, or email when that claim is absent. The object ID belongs to the configured tenant. |

Login starts at `/login`; register the exact callback
`PUBLIC_BASE_URL/oauth/{provider}/callback`. Google/Entra ID tokens are validated
for signature, issuer, audience, and nonce; OAuth state and PKCE protect login.
Authenticated cookies contain only minimal signed identity and expiry, not
provider tokens. Cookies are HttpOnly, SameSite=Lax, and Secure except for
explicit local HTTP development. Sessions expire after eight hours, and the
current allowlist is checked on every reader request. Logout is `POST /logout`
and requires an exact matching `Origin`; it is unavailable before a canonical
origin is configured.

An unfinished sign-in attempt expires after **10 minutes**, independently of the
eight-hour reader session. Expired or missing sign-in cookies produce a 401
recovery page for browser requests, with a **Sign in again** link to `/login`.
Restart there in the same browser instead of refreshing or sharing the callback
URL; it contains a one-use authorization code. Clients not requesting HTML keep
the existing JSON error. Logs record only a fixed failure reason, never the
callback URL, code, state or cookie. Invalid state, token and allowlist checks
still fail closed; recovery does not extend or reuse an old transaction.

OAuth HTTP clients keep TLS verification enabled and honor the platform's
certificate/proxy environment, including `SSL_CERT_FILE` and `SSL_CERT_DIR`.
Disabling environment trust broke Entra discovery in the live Express
deployment; disabling certificate verification is not an acceptable workaround.

## Reading and publishing

`GET`/`HEAD /{blob_path}` require reader authorization, including images, audio,
and ranged requests. `/` reads `index.html`. Missing reader sessions redirect
GET to `/login`; HEAD returns 401. Responses use `Cache-Control: private, no-store`.
Blob paths reject traversal, empty segments, ambiguous encoded separators,
backslashes, controls, and reserved top-level routes.

Single byte ranges support `bytes=start-end`, `bytes=start-`, and `bytes=-suffix`.
Success returns 206 with `Content-Range` and `Content-Length`; invalid,
multi-range, or unsatisfiable ranges return 416 with `Content-Range: bytes */size`.
HEAD returns the corresponding headers without a body. `If-Range` applies a
range only when it exactly matches the current ETag; otherwise the full
representation is returned.

Every management operation requires both enabled publishing and
`Authorization: Bearer <token>`. URL-safe encode at least 32 random bytes to
generate the token; keep it client-side and configure only its SHA-256 hex digest.
The runtime hashes the supplied token and compares digests in constant time.
Reader cookies never authorize management reads or writes.

| Endpoint | Behavior |
| --- | --- |
| `GET /_publish/blobs?prefix=...&cursor=...` | List a page from the fixed container. |
| `GET`/`HEAD /_publish/blobs/{blob_path}` | Read one blob, with the same range behavior. |
| `PUT /_publish/blobs/{blob_path}` | Create or explicitly overwrite from a raw request body; returns 200 with `path`, `size`, `content_type`, and `etag`, plus the ETag header. |
| `DELETE /_publish/blobs/{blob_path}` | Delete exactly one path; returns 204. No recursive delete or synchronization. |

Listing returns at most 100 entries per page:

```json
{"items":[{"path":"file.html","size":123,"content_type":"text/html","etag":"\"...\""}],"next_cursor":null}
```

Continue with the returned non-null `next_cursor` unchanged and the same prefix.
Stop when it is null. Cursors are signed, prefix-bound, and expire after 24 hours;
invalid, mismatched, or expired cursors return 400.

Uploads stage bounded 4 MiB blocks with per-upload identifiers and atomically
commit only after the whole body passes validation. The byte limit is enforced
during streaming even without `Content-Length`. Failed streaming leaves no
committed partial replacement; an existing committed blob remains unchanged.
Uncommitted blocks are left for Azure expiration rather than deleting existing
content. Successful commits set the Cool tier and validated/inferred Content-Type;
Azure assigns the ETag. PUT/DELETE accept one strong `If-Match` ETag or `*`;
PUT additionally supports `If-None-Match: *` for create-only writes. Failed
preconditions return 412; unsupported conditional forms return 400.

Keep the UAMI at container-scoped Storage Blob Data Reader in steady state.
Deployment orchestration may temporarily add scoped Storage Blob Data Contributor
and enable publishing with a fresh digest, then disable publishing, remove the
digest, and revoke the temporary Contributor assignment in `finally`.
The runtime does not manage these roles or create a direct AzCopy access window.

## Liveness and failures

`GET`/`HEAD /healthz` returns 200 without accessing storage. **It is liveness,
not storage, private-network, content, or RBAC readiness.** A healthy process can
still return 503 for storage authorization failures during RBAC propagation,
credential/network failures, or upstream service failures. Use a real blob request
to check storage readiness; retry transient 503 responses with bounded backoff.
A missing blob/container returns 404, including an unpublished `index.html`.

Disabled management returns 404 before storage access; missing/incorrect bearer
credentials return 401. Invalid input returns 400, oversized bodies 413, and
storage conflicts 409. Upstream storage request errors can return sanitized 502.
Errors never expose storage account URLs or credentials. If a download fails
after headers were sent, the stream aborts instead of completing a truncated
success; clients must detect the failed/incomplete transfer.
