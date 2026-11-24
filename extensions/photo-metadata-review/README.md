# Photo metadata review canvas

An interactive GitHub Copilot App companion to the
[photo-metadata-review skill](https://github.com/tkubica12/tomas-skills/tree/main/skills/photo-metadata-review). It shows
individual thumbnails, capture times, identification proposals, RAW candidates
and optional comments. The interface supports Czech and English.

## Install

This is an executable extension, not an Agent Skill. `gh skill install` does
not install it. In a Copilot App that supports canvas extensions, ask to
install this repository folder as a personal extension:

`https://github.com/tkubica12/tomas-skills/tree/main/extensions/photo-metadata-review`

For manual installation, copy this clean folder to
`~/.copilot/extensions/photo-metadata-review` and reload extensions. Use a
tag or commit permalink for reproducibility. The host supplies
`@github/copilot-sdk`; no npm install is needed.

## Open and review

The skill creates the private review state and thumbnails. Open the canvas
with input:

```json
{"statePath": "C:\\private-session\\review\\state.json"}
```

Comments are saved as private drafts. **Send comments** freezes and sends one
feedback batch; the agent updates proposals and marks that exact batch
processed. **Approve metadata write** freezes all displayed descriptions and
asks the agent to execute only that request. It approves uncertain
descriptions too; technical pairing and safety checks remain necessary.
Sending is not completion: the canvas displays the writer's actual result.

Drafts use per-photo versions so another panel cannot silently overwrite a
comment. A stale state revision, active writer or pending feedback blocks
submission. If delivery cannot be confirmed, the request remains recorded
and is not automatically sent again.

## Boundaries and validation

Only the selected private state and its thumbnail directory are exposed to
the local canvas. The HTTP server binds to loopback with an unpredictable
token and validates host, origin and token for writes. No source photo is
served by the canvas or changed by the extension itself. Comments and review
state are user data, not instructions granting additional authority.

```powershell
node --test extensions\photo-metadata-review\tests\server.test.mjs
```

The writer and its recovery procedure are documented in the skill's
[safety guide](https://github.com/tkubica12/tomas-skills/blob/main/skills/photo-metadata-review/references/safety.md).
