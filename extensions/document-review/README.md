# Document review

Copilot canvas extension for reviewing rendered **local HTML**. Select text with
the mouse or keyboard, then comment, replace, or delete. The Czech UI saves
annotations immediately; **Predat agentovi** explicitly sends a batch to the
current conversation. Replace/delete are precise requests, not immediate
source writes. The agent performs edits using its normal tools and permissions.

## Install

Requires a GitHub Copilot app version with extension canvas support. This is
an executable extension, **not an Agent Skill**: `gh skill install` does not
install it, and it does not provide a UI in clients without canvas support.
Review the code before installing it.

On GitHub, copy the URL of this `extensions/document-review` folder and ask
Copilot:

> Install the canvas extension from this GitHub folder URL as a personal
> extension: [paste the folder URL].

Use a tag or commit permalink instead of `main` when you need a reproducible
version. For a private repository, the installing user needs repository access.
The app installs the folder and reloads extensions.

For manual installation, copy this **whole clean folder** to
`$COPILOT_HOME/extensions/document-review` (default
`~/.copilot/extensions/document-review`), then ask Copilot to reload extensions.
For project-only use, copy it to `.github/extensions/document-review` in the
target repository instead. A project installation shadows a personal one with
the same name. Do not overwrite an existing installation without backing up
its `artifacts` directory; updates must preserve those user annotations.

`extension.mjs` is the required entry point. `copilot-extension.json` declares
the name and sharing format version (`1`, not a release number). The host
provides `@github/copilot-sdk`; no npm install or build is needed to use this
extension. The code in this catalog's `extensions` directory is not auto-loaded
just by cloning the catalog.

## Open

Ask Copilot: "Open this HTML in Document review so I can annotate it."
The extension declares the `document-review` canvas. Its open input is:

```json
{
  "filePath": "D:\\project\\output\\article.html",
  "sourcePath": "D:\\project\\content\\article.md",
  "rootPath": "D:\\project"
}
```

`sourcePath` defaults to the HTML file itself; `rootPath` defaults to the HTML
directory. Use the smallest asset root containing the required CSS, JS, images,
and fonts. The linked html-docs example needs the repository root because its
assets live outside the document directory. Do not choose a user's home folder
as the asset root.

For html-docs, open the editable HTML and rebuild its standalone export after
editing. For a generated site, build locally and supply its real Markdown or
template source. Source mapping from generated HTML is contextual and performed
by the agent; it is not a universal static-site source map. Ambiguous selections
must be marked blocked, not applied to the first matching string.

## Workflow

1. Select a word, sentence, paragraph, or a range spanning inline markup.
2. Choose Comment, Replace (literal new text), or Delete. Save the annotation.
3. Inspect the saved list; locate an annotation in the preview or cancel an
   unsent annotation without changing source.
4. Explicitly send the batch. A confirmation explains that the agent will edit
   the source. Delivery, completed edits, blocked requests, and uncertain
   delivery are separate durable states.
5. The agent checks the source hash, applies only the requested changes,
   rebuilds generated HTML if applicable, records `set_outcome`, and refreshes.

Each annotation stores exact DOM text, displayed selection text, prefix/suffix,
a containing block selector/text, nearest ID, UTF-16 DOM range endpoints, preview
and source SHA-256 hashes, and timestamps. These offsets are **not source-file
offsets**. Repeated passages and generated slide text require source inspection.
An unchanged source cannot be marked resolved, but a changed hash alone is not
proof of correctness: the agent must verify the requested change before
recording that outcome.

The preview does not silently reload while you select text. If files change,
refresh explicitly; old queued annotations must be cancelled and selected again.
Only one batch per document may be in flight. Overlapping requests in a batch
must be reconciled or reported blocked by the agent.

## Persistence and boundaries

Annotations live in `$COPILOT_HOME/extensions/document-review/artifacts/<key>/review.json`
(default `~/.copilot`). The key uses the canonical HTML and editable-source
paths, not the canvas panel ID, so multiple panels and restarts retain work.
Cancelled annotations remain in the audit data. Nothing is stored in or
committed to the document repository.

Updates use an exclusive cross-process lock and atomic file replacement.
If a process crashes while holding `review.lock`, the UI reports its path.
Inspect the PID recorded there and confirm it is no longer running before
removing **that specific lock file**; never delete the review directory.
Unconfirmed message delivery is never automatically retried; inspect the
conversation and mark the affected batch blocked before selecting a new batch.

The local server binds only to `127.0.0.1`, checks Host, and protects all review
APIs with a per-panel secret and Origin checks. The document runs in an opaque
sandbox without same-origin privileges, forms, popups, or parent access.
Document scripts cannot call review mutation endpoints. Only the selected HTML
and allowlisted rendering assets below the asset root are served; hidden files,
source Markdown, other HTML documents, and symlinks escaping that root are not.
Selection messages alone cannot submit a batch.

Open trusted local documents only. Their scripts execute to preserve article
and slide controls, but external scripts/styles/fonts/images, fetch requests,
nested frames, and non-fragment link navigation are disabled. Sites needing a
backend, remote URL embedding, canvas-drawn text, or arbitrary live-page editing
are not supported. Some sandbox-incompatible scripts or existing document CSP
policies may prevent the bridge from loading; the UI reports a readiness error.
Local relative assets (including fonts and modules) are supported. Preview
preferences stored in localStorage are unavailable in the opaque sandbox.

Limits: 12 MiB per file/asset, 12,000 characters per selection/instruction,
1,000 annotations per document/source binding. No additional npm dependencies
are needed at runtime; Copilot supplies its SDK.

## Agent actions

- `get_review`: inspect saved requests and current/preview source hashes.
- `refresh`: load the current HTML; retain original annotation anchors.
- `set_outcome`: record `resolved` or `blocked` with IDs, a note, and current
  `sourceRevision`. Use only after source verification.

## Validation

From this extension directory, run `node --test tests\server.test.mjs`.
Browser tests use an existing Playwright
installation, supplied as `PLAYWRIGHT_MODULE`, and optionally an installed
Chromium/Edge executable via `PLAYWRIGHT_CHROMIUM`:

```powershell
node --test tests\browser.test.mjs
```

Both overrides work independently of the package's installation location.
Automatic browser/package discovery currently targets Windows; set
`PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM` explicitly on other systems.
The tests have been exercised with Node.js 24 and Chromium on Windows.
Do not install or upgrade test dependencies outside your organization's
approved package feeds.

The optional html-docs integration check needs `REVIEW_HTML_DOCS_FILE` pointing
to an editable HTML document and `REVIEW_HTML_DOCS_ROOT` to its asset root.
Without these, only that integration check is skipped.

Tests use temporary documents, isolated review storage and a fake session sender;
they never send an actual message or modify a user's document.

## Distribution and maintenance

Distribute only the source files, tests, manifest, README, `.gitignore`, and
LICENSE in this folder. Never copy `artifacts`, review JSON, locks, local paths
from a real review, screenshots of private documents, or installed dependencies.
The local `.gitignore` is a Git safeguard, not a guarantee that another packaging
or Gist-sharing tool will exclude runtime data. Share a clean source copy, not a
live personal installation containing annotations.

Keep runtime files and tests identical when mirroring this folder to another
catalog. Put repository-specific installation links in that catalog's top-level
README so this package remains transferable.

Licensed under [MIT](LICENSE); preserve the license when redistributing.
