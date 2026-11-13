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

Each browser run checks all eight light/dark x blue/red/green/yellow combinations,
with networking disabled and system theme opposite the requested theme:

- Appearance toggles, warning/accent coherence, document metadata and unique IDs.
- Exact light/dark accent pairs, light text contrast of at least 4.5:1 on the
  canonical neutral and accent-soft surfaces, and legacy `orange` URL,
  saved-preference, and JavaScript/no-JavaScript default compatibility.
- Presentable articles: opening/closing and one authored surface per card.
- Article slide limits: 45 words, three points, ten words per point,
  18 words per paragraph, no interactive reading content.
- Card and reveal behavior and matching expanded state.
- Exact narrative order and whole-slide traversal, including chapter dividers.
- Slide clipping, deck readability floor and 65-word budget.
- Fragment accessibility, reduced-motion navigation, named index and focus return.
- Sheets: every page fits its paper, text at least 7.5 pt, labelled marks, no
  interactive content; companion Sheet view switching with Slides and Escape.
- Console warnings/errors, failed requests, required network requests, images.
- No-JavaScript visibility and full article reference-text parity, excluding
  intentionally hidden presentation summaries and companion sheets.

A print pass then selects every view the document offers, as the **PDF**
button would, from a dark screen theme. It checks the print target follows the
view, then renders both light and explicit dark palettes. Nothing may clip,
each generated PDF has exactly one page per slide or sheet page, and pagination
must not change with the palette. Screen dark alone must still print light.

Exit code 0 means every assertion passed. `--shots` captures reading, the
full sheet, and every presentation surface with points revealed in each
palette. It does not make a visual judgment. Keep validation screenshots/logs
outside public deliverables, except a deliberately selected showcase image.

## PDF deliverables

When PDF is requested, export and then open each file:

```powershell
node assets\export-pdf.js my-document.standalone.html --out validation\pdf
node assets\export-pdf.js my-document.standalone.html --theme dark --out validation\dark-pdf
```

See [PDF export](pdf-export.md). Inspect every page: sheet composition,
slide pages matching the presentation, reading page breaks, and the selected
accent. For dark output check actual page edges and page-number contrast too;
print-emulated HTML is not proof of the PDF's page background.

## PowerPoint deliverables

When a `.pptx` is requested, export it and run the PowerPoint comparison:

```powershell
node assets\export-pptx.js my-document.standalone.html
node assets\test-pptx.js my-document.standalone.html
```

`test-pptx.js` exports its own copy under `validation\pptx`. The comparison
needs desktop PowerPoint on Windows; elsewhere it reports the
render check as skipped. Inspect `diff\` for red marks, then open the `.pptx`
and check every slide and a few text boxes. See
[PowerPoint export](pptx-export.md).

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
2. Inspect opening, divider, diagram, busiest slide, and closing in all eight
   palettes at laptop and projector sizes. Diagrams must inherit the selected
   accent; no independent warning or category colors. Natural scene colors and
   authorized logo pixels are not UI accents. For optional compositions, check
   hero copy stays over the opaque surface and every crop preserves its
   important subjects in Read, Slides, and print.
   Ask why an item is emphasized, whether the relationship is ordered or peers,
   and which edges should align. Neutral peers must look equal; sequence arrows
   mean progression, not a disguised ranking. Panoramas, captions, related prose,
   and quote containers normally share the outer card edges at content width.
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
node assets\sync-head.js --check article.template.html article.components.html deck.template.html deck.components.html sheet.template.html
node assets\validate.js article.template.html
node assets\validate.js article.components.html
node assets\validate.js deck.template.html
node assets\validate.js deck.components.html
node assets\validate.js sheet.template.html
node assets\sync-head.js --check visual.article.html visual.deck.html
node assets\validate.js visual.article.html
node assets\validate.js visual.deck.html
node assets\test-compositions.js
node assets\test-print.js
node assets\test-pptx.js
```

Regenerate affected standalone outputs and refresh representative screenshots.

`test-compositions.js` uses the existing validator's Playwright/browser
discovery; it adds no dependencies. It bundles both fictional visual galleries
into isolated folders under `test-results\compositions`, checks image sizing,
focal crops, circle/oval/diagonal/organic geometry, hero text-safe contrast,
natural-image color preservation, no-JS/offline load, narrow reading,
presentation hash focus, and print geometry across both themes and viewport
sizes. It measures the shared outer edges of peer cards, panorama, caption,
and related text, without claiming to judge their semantics.
Pass `--shots` to capture representative compositions. Output remains
under the ignored `test-results` folder, not in distributable assets.

`test-print.js` checks neutral sequence items and explicit emphasis at every
position in all eight appearances and print. It exercises the actual PDF
button, print-target/title restoration, independent print-theme controls,
URL/storage/author precedence, selected accents, authored no-JS dark printing,
and CLI errors. It exports real default-light, explicit-dark, authored-dark,
and forced-light PDFs of a combined article, deck, and standalone sheet,
requiring matching counts. Files remain in `test-results\print` for rendered
page inspection. These measurements do not replace visual review.

`test-pptx.js` exports the deck gallery in light, dark, and picture-only text
modes, the article gallery's slides, and the visual deck to
`test-results\pptx`. It checks slide counts, titles, notes, and native text,
renders every slide in desktop PowerPoint, and fails when any 32 × 32
slide-pixel area differs from Chromium on more than 2% of its pixels after a
2 px blur, tolerating one render pixel of pixel-grid snapping. It also checks
invalid options and refuses a standalone sheet. Without desktop PowerPoint on
Windows the render comparison is reported as skipped.
