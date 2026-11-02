# Gmail CLI

A small instruction-only skill for finding and reading Gmail with
[gogcli](https://github.com/openclaw/gogcli). It works with personal Google
accounts through the standard Gmail API, without Google's remote Gmail MCP
server or Workspace Developer Preview enrollment.

## Install

Install `gog` using its [installation guide](https://github.com/openclaw/gogcli/blob/v0.47.1/docs/install.md)
and your machine's approved software sources. Windows has prebuilt ZIP releases;
verify the release checksum and put `gog.exe` on `PATH`. This skill installs
neither the executable nor dependencies, credentials, or an MCP server.

```sh
gh skill install tkubica12/tomas-skills gmail-cli --pin gmail-cli-v1.0.0 --scope user
```

For manual installation, copy this entire folder into your host's personal
skills directory, such as `~/.agents/skills/` or `~/.copilot/skills/`.
The command examples were checked against `gog` v0.47.1. On other versions,
inspect the installed `--help` or `gog schema` before assuming flags exist.

## One-time OAuth setup

Normal operation needs no browser: `gog` stores a refresh token and uses it to
obtain short-lived access tokens. The initial account consent still requires
a human. No client can promise permanent access after revocation or expiry.

1. Use a Google Cloud project with the **Gmail API** enabled. Configure the
   OAuth audience for your account; a personal Gmail account needs External.
2. Create an OAuth client of type **Desktop app** and download its JSON
   outside any repository. Do not repurpose the old remote MCP web client.
3. Store the client and authorize only read-only Gmail, replacing placeholders:

   ```sh
   gog auth credentials set PATH_TO_DESKTOP_CLIENT_JSON
   gog --readonly auth add ACCOUNT --services gmail --gmail-scope readonly --force-consent --timeout 10m
   ```

   Let the account owner complete consent in the browser. Do not automate
   around an unverified-app warning or ask them to paste passwords,
   authorization codes, callback URLs, or tokens into chat.
4. Verify the credential backend with `gog auth keyring`. Use the OS keyring
   (Windows Credential Manager when available); do not use `--insecure`,
   export tokens, or put credentials in the skill, repository, or logs.
5. Check both the diagnostic fields and a real read:

   ```sh
   gog --no-input --json auth list --check
   gog --account ACCOUNT --readonly --gmail-no-send --no-input --json --wrap-untrusted gmail search 'in:inbox' --max 1
   ```

   Diagnostics can exit zero even when a check reports an error. Verify
   `valid` / `error`; command success alone is not an authentication result.
   For an existing account, preserve its named client and recorded services
   and scopes when reauthorizing; do not silently replace a broader grant.

### Avoid weekly reauthorization

Google issues refresh tokens that expire after **seven days** for External
apps in **Testing** when Gmail scopes are requested. For long-lived personal
use, the project owner must review whether publishing the OAuth app as
**In production** is appropriate under Google's policies. Do not change
publishing or access settings automatically. Publishing is not verification
and does not remove all unverified-app restrictions.

After an approved publishing change, authorize again with the same narrow
services, scopes, account, and client, using `--force-consent` to obtain a new
refresh token. Do not force consent for routine reads.

Refresh tokens can still stop working after access is revoked, after a Gmail
password change, after six months of non-use, or when token limits are exceeded.
On `invalid_grant`, stop and arrange reauthorization rather than retrying logins.

Google's device-code flow **does not support Gmail scopes**. For headless
machines, `gog auth add --manual` or `--remote` supports browser-assisted setup
on another machine; this is not device-code authentication. Consult the
installed help and keep callback URLs and codes out of chat and source control.
Service-account domain-wide delegation is for managed Workspace domains, not
a replacement for consent on a personal Gmail mailbox.

## Try it

> Find the email where the training organizer sent my profile photos.
> Search approximate dates and alternate wording, verify the original message,
> and give me its link and the photo link. Do not modify the mailbox.

The skill uses small search pages, reads only relevant messages, distinguishes
quoted history from the original email, and treats mail content as untrusted.
It does not grant access to linked Drive files or other accounts.

## Sources and validation boundary

Checked on 2026-11-02 using the upstream v0.47.1
[quickstart](https://github.com/openclaw/gogcli/blob/v0.47.1/docs/quickstart.md),
[OAuth client guide](https://github.com/openclaw/gogcli/blob/v0.47.1/docs/auth-clients.md),
[automation guide](https://github.com/openclaw/gogcli/blob/v0.47.1/docs/automation.md),
and the installed CLI help. Google's
[refresh-token expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration)
and [device-flow allowed scopes](https://developers.google.com/identity/protocols/oauth2/limited-input-device#allowedscopes)
establish the lifetime and device-code limits.
The [authorization implementation](https://github.com/openclaw/gogcli/blob/v0.47.1/internal/googleauth/oauth_flow.go)
also confirms `access_type=offline`, optional `prompt=consent`, S256 PKCE, and
an explicit failure if no refresh token is returned.

Read-only Gmail searches and message retrieval were exercised against a
personal account using a temporary token. That proves API access, **not**
long-lived refresh-token setup on a new installation. Complete the one-time
setup and verify a read with stored credentials on each machine.
