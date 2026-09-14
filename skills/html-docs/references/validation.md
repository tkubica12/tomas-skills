# Validation

Validate the editable source and the file actually delivered. Automated checks
catch broken behavior and clipping; visual inspection catches cramped slides
and diagrams with overlapping labels.

## Requirements

The exporter needs only Node.js. The validator additionally needs Playwright
and Chromium, or a compatible installed Chromium-based browser.

Try existing packages and browser installations first:

```powershell
node assets\validate.js my-document.html
```

The validator searches common Playwright installations and browser caches.
Override either location when needed:

```powershell
$env:PLAYWRIGHT_MODULE = "<existing-node-modules>\playwright"
$env:PLAYWRIGHT_CHROMIUM = "<installed-browser>\chrome.exe"
node assets\validate.js my-document.html --shots validation\source
```

An installed Edge executable can also be supplied as `PLAYWRIGHT_CHROMIUM`.
If dependencies are missing, use the environment's approved package registry
and browser-installation policy. Inspect its effective registry and available
versions before installing. Do not bypass a managed feed or blocked browser
download.

## Source checks

```powershell
node assets\validate.js my-document.html --shots validation\source
```

Exit code 0 means every automated check passed. The checker covers:

- Console warnings/errors, failed requests, theme bootstrap, title/description,
  one `h1`, image loading and accessibility attributes, emoji, inline colors.
- With JavaScript disabled: card/reveal/panel/slide visibility and text coverage.
- Articles: card state, tab labels, expand/collapse, theme toggle, slides entry,
  navigation, slide overflow, and `Escape` exit.
- Decks: stage fit, slide overflow, authored IDs, end navigation, index, theme.

The screenshots are light/dark article views or the deck's current slide.
They are **not** a complete slide-by-slide visual review.

## Isolated standalone checks

Export, then copy only the generated HTML and validator to a fresh validation
folder. Keep that folder outside public deliverables; do not leave an `assets`
directory beside the export.

```powershell
node assets\bundle.js my-document.html
# Run from the document folder; use a new folder name for each isolated check.
New-Item -ItemType Directory validation\isolated | Out-Null
Copy-Item my-document.standalone.html validation\isolated
Copy-Item assets\validate.js validation\isolated
node validation\isolated\validate.js validation\isolated\my-document.standalone.html --shots validation\export
```

Also open the isolated export with browser networking disabled. Verify that it
has no required remote stylesheets, scripts, fonts, images, or other assets.
External citation links are allowed but must not be needed to read the content.
Repeat with JavaScript disabled: all detailed prose must remain readable.

The exporter wraps deferred scripts because `defer` is ignored on an inline
script. If expand-all, theme, and slides all fail only in the export, check that
the wrapper survived rather than working around each symptom.

## Browser review

1. Read the collapsed article: card titles must carry the argument.
2. Open each reveal. Verify the promised explanation is present and readable.
3. In **both themes**, inspect article, chapter divider, diagram, busiest card,
   and closing takeaway.
4. Enter slides using the toggle and `?view=slides`. Traverse every slide at
   1440×900 and 1920×1080. Check the index, keyboard navigation, and return to
   the document. No slide should depend on opening a reveal.
5. Measure the fit as well as overflow. A slide squeezed below about 70% needs
   less content, even if it technically fits.
6. Check links, provenance, and explicit assumptions. Fictional inputs must not
   look like production measurements.
7. If a PDF was requested, exit slides before printing an article; check the
   actual PDF. For a deck use landscape printing.

Fix clipping by splitting cards or moving detail behind reveals, never by
changing the runtime or adding per-page typography overrides.

## Shared-runtime regressions

If shared CSS or JavaScript changes, validate all reference fixtures and
visually compare their themes:

```powershell
node assets\validate.js article.template.html
node assets\validate.js article.components.html
node assets\validate.js deck.template.html
node assets\validate.js deck.components.html
```

Document the runtime change and re-export affected deliverables. Do not publish
screenshots, dependency folders, or validation logs as part of the skill.
