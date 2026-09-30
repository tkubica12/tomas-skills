# Changelog

## 1.2.0 — 2026-09-30

**Four Microsoft-logo accent families, with readable light-mode shades.**

### Changed

- Accent cycles blue, red (red-orange), green, yellow across articles, slides,
  decks, and sheets. One family remains active throughout a document.
- Dark mode uses the exact logo values: blue `#00A4EF`, red `#F25022`,
  green `#7FBA00`, yellow `#FFB900`.
- Light mode uses the approved design-preview shades: blue `#006DA0`,
  red `#BC3A16`, green `#4C7100`, yellow `#805B00`. These are this skill's
  design, not officially documented Microsoft counterparts.
- PDFs use the selected family's light shade, even from a dark screen.
- Legacy `orange` URL overrides, authored defaults, and stored choices map
  to `red`; CSS also preserves the no-JavaScript `orange` default.
- Templates, component galleries, example HTML/PDFs, and documentation use
  the updated canonical head. Browser validation covers all eight palettes,
  exact shade pairs, light text contrast, and legacy accent compatibility.

### Upgrading a document

Copy the updated assets, run `node assets\sync-head.js` on the linked source,
then rebuild its standalone HTML and PDFs. Prefer `red` in new defaults and
links; existing `orange` values remain accepted.

## 1.1.0 — 2026-09-28

**Sheets, PDF export, and a screen that stays awake while presenting.**

### Added

- **Sheet view** for one-pagers, datasheets, and briefs. Every `.sheet-page`
  is exactly one A4 or Letter page, previewed on screen as it prints. Use it
  as a standalone document (`sheet.template.html`) or as a third view beside
  an article's Read and Slides. Components: kicker, claim title, key figures,
  block grid, comparison matrix with drawn marks and legend, actions, closing
  line, and footnotes. See `references/sheet.md`.
- **PDF button** in every shape. It prints the view on screen (document,
  slides, or sheet) from a local file, with no server. `Ctrl+P` does the same.
- **`assets/export-pdf.js`** writes one PDF per view, tagged and bookmarked.
  It refuses to write a view whose pages clip, whose page count differs from
  its slides or sheet pages, or whose page did not load cleanly. See
  `references/pdf-export.md`.
- **Screen wake lock** while presenting in article slides mode or a deck, so
  the display does not dim, blank, or start the screen saver.
- Validator checks for sheets (fit, 7.5 pt text floor, labelled marks, view
  switching) and a print pass for every view, including exact PDF page counts.

### Changed

- Every printout and PDF uses the light palette; dark tokens apply on screen.
- The reading PDF has page numbers, keeps long cards flowing across pages
  instead of pushing them whole to the next page, and starts without the
  screen header's top padding.
- Slides print one 16:9 page per slide with every point shown.
- `SKILL.md` chooses among Read, Slides, and Sheet views, and asks when the
  request leaves the combination unclear.
- The example now includes a companion sheet and its three PDFs.

### Upgrading a document

Copy the new `assets` folder, then run `node assets\sync-head.js` on the
source so its inline head matches the new `appearance.js` and `tokens.css`.
Add `<button type="button" class="ctrl" data-action="print">PDF</button>` to
the controls, and rebuild the standalone export.

## 1.0.0 — 2026-09-15

First published version: article with slides mode, slide-first deck,
single-accent light/dark themes, single-file export, and browser validation.
