# Validation

Validate the source and the actual standalone deliverable. Browser checks
detect broken behavior and clipping; screenshots detect cramped composition.

## Setup

The exporter and head synchronizer need only Node.js. Validation additionally
needs Playwright and Chromium or a compatible installed browser. Try existing
packages first:

```powershell
node assets\validate.js my-document.html
```

The validator searches common global Playwright installations and browser
caches. Override either when necessary:

```powershell
$env:PLAYWRIGHT_MODULE = "<existing-node-modules>\playwright"
$env:PLAYWRIGHT_CHROMIUM = "<installed-browser>\chrome.exe"
node assets\validate.js my-document.html --shots validation\source
```

An installed Edge executable also works. For missing dependencies, inspect the
effective registry, query versions from the environment's approved feed, and
follow browser-installation policy. Never bypass a managed package feed or a
blocked browser download.

## Automated checks

```powershell
node assets\sync-head.js --check my-document.html
node assets\validate.js my-document.html --shots validation\source
node assets\validate.js my-document.html --viewport 1920x1080
```

Each browser run checks all six light/dark x blue/orange/green combinations,
with networking disabled and system theme opposite the requested theme:

- Appearance toggles, warning/accent coherence, document metadata and unique IDs.
- Presentable articles: opening/closing and one authored surface per card.
- Article slide limits: 45 words, three points, ten words per point,
  18 words per paragraph, no interactive reading content.
- Card and reveal behavior and matching expanded state.
- Exact narrative order and whole-slide traversal, including chapter dividers.
- Slide clipping, deck readability floor and 65-word budget.
- Fragment accessibility, reduced-motion navigation, named index and focus return.
- Console warnings/errors, failed requests, required network requests, images.
- No-JavaScript visibility and full article reference-text parity, excluding
  intentionally hidden presentation summaries.

Exit code 0 means every assertion passed. `--shots` captures reading and every
presentation surface with points revealed in each palette. It does not make a
visual judgment. Keep validation screenshots/logs outside public deliverables,
except a deliberately selected showcase image.

## Isolated export

```powershell
node assets\bundle.js my-document.html
New-Item -ItemType Directory validation\isolated | Out-Null
Copy-Item my-document.standalone.html validation\isolated
Copy-Item assets\validate.js validation\isolated
node validation\isolated\validate.js validation\isolated\my-document.standalone.html
```

Use a fresh folder containing only the export and validator, not an assets
directory. The validator's offline browser proves references are resolved;
its no-JavaScript pass proves the detailed reading content survives without
the runtime. The exporter wraps deferred scripts because an inline script's
`defer` attribute alone does not delay execution.

## Human browser review

1. Read the collapsed card titles and expanded prose. Verify assumptions,
   sources, fictional inputs, and the reasoning behind each cue.
2. Inspect opening, divider, diagram, busiest slide, and closing in all six
   palettes at laptop and projector sizes. Diagrams must inherit the selected
   accent; no independent warning or category colors.
3. Test `?view=slides#card-id`, reload, theme/accent persistence, keyboard focus,
   native Space on controls, index selection, fragments and whole-slide skips.
4. Check narrow reading layouts and browser zoom. A landscape presentation
   viewport is recommended; shorten surfaces rather than add tiny typography.
5. Disable JavaScript: complete reading content, not duplicated summaries,
   must remain available. Print an actual PDF if PDF is requested.

The opening and final message should look intentionally composed. Other slides
must provide space for the speaker, not require the audience to read paragraphs.
Article slides never auto-shrink; deck bodies may fit only as low as 0.85.
Passing overflow alone is not sufficient.

## Shared-runtime regressions

Validate every fixture after changes:

```powershell
node assets\sync-head.js --check article.template.html article.components.html deck.template.html deck.components.html
node assets\validate.js article.template.html
node assets\validate.js article.components.html
node assets\validate.js deck.template.html
node assets\validate.js deck.components.html
```

Regenerate affected standalone outputs and refresh representative screenshots.
