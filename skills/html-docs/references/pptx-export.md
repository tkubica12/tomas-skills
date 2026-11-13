# PowerPoint export

PowerPoint is an optional delivery format for the slides view, beside the
PDF, for people who must receive or submit a `.pptx`. The HTML remains the
source: edit it and export again rather than maintaining the presentation.

| Document | File | Slides |
|---|---|---|
| Deck | `my-deck.pptx` | Every slide |
| Article with Slides | `my-document.slides.pptx` | Opening, chapter dividers, cards, closing, as in the slides PDF |

Read and Sheet are paper views and have no PowerPoint form. A document without
a slides view, such as a standalone sheet, is refused.

## Export

```powershell
node assets\export-pptx.js my-document.standalone.html
node assets\export-pptx.js my-document.standalone.html --theme dark --accent green --out dark-pptx
node assets\export-pptx.js my-document.standalone.html --text image --out archive
```

- `--out <folder>` writes beside the HTML by default. A `.standalone` suffix is
  dropped from the name, as for PDFs.
- `--theme light|dark` follows the PDF rules: without it the authored
  `data-print-theme` applies, otherwise light.
- `--accent blue|red|green|yellow` selects the accent family for that run;
  without it the document's `data-default-accent` applies. Ask for theme and
  accent before exporting, and keep one output folder per palette.
- `--text native` (default) makes text editable. `--text image` makes
  picture-only slides that look identical on every machine but cannot be
  edited or searched; use it for archival copies or unknown recipient fonts.
- `--width 1280-7680` sets the pixel width of each slide picture, default
  2560. Wider is sharper on large screens and makes a bigger file.
- `--no-notes` omits the speaker notes of article slides.

It needs Playwright and Chromium, like `export-pdf.js`, loads the page
offline, and writes nothing if a slide clips. The output line reports how
many characters became native text and why any text stayed in the picture.

## How it stays identical

Each slide has two layers:

1. **Design picture**: the slide background is Chromium's printed slide, the
   same rendering as the slides PDF, with the exported text removed. Boxes,
   rules, SVG diagrams, images, gradients, and kept text are therefore exact.
   Being the background, it cannot be dragged out of place by accident.
2. **Native text**: every paragraph becomes an editable text box with the
   document's fonts, sizes, weights, colors, and line breaks, placed where
   Chromium laid it out. A calibrated model translates CSS line boxes into
   PowerPoint's placement: whole-percent line spacing, 1/8 pt glyph advances,
   baselines from the font's descent, and the device-pixel snapping of the
   capture. When PowerPoint's wrapping cannot reproduce a paragraph's lines,
   each line becomes its own box; it stays editable but no longer reflows.

Every slide has a title placeholder, either its visible title or, for quotes
and closings, a title placed above the slide, so the outline, navigation, and
accessibility checker work. Article slides carry their card's full reading
text, reveals included, as speaker notes; decks have none. Point-by-point
fragments are all shown, as in the PDF. The theme colors and fonts come from
the document tokens, so shapes added in PowerPoint match the design.

## Text kept in the picture

Text that PowerPoint cannot draw identically stays in the design picture. It
looks exact but is not editable:

- effects: underline or strike, text-shadow, stroke, filter, blend mode,
  clip-path or mask, background-clip text, transforms;
- layout: vertical or right-to-left text, line clamp, ellipsis, text covered
  or clipped by another element, irregular layouts, SVG text on a path,
  rotated, stroked, or unevenly scaled;
- fonts: font features or `font-size-adjust`, a glyph missing from the font,
  a font PowerPoint cannot name, and synthesized bold or italic. A browser
  slants or emboldens a family without that face; PowerPoint does it
  differently. Segoe UI Variable has no italic, so `<em>` in body text stays
  in the picture. Use families with real faces where text must be editable.

## Fonts on the recipient's machine

A `.pptx` names fonts rather than embedding them. The design picture is the
same everywhere, but native text needs the exporting machine's fonts:
with the canonical tokens on Windows, Segoe UI Variable and Cascadia Mono.
Without them PowerPoint substitutes another font and lines can shift or
rewrap. When the recipients' platform or fonts are unknown and editing is
not required, export `--text image` as well or instead.

The model was calibrated against Microsoft PowerPoint for Windows.
PowerPoint for Mac or the web was not measured.

## Verify

```powershell
node assets\test-pptx.js my-document.standalone.html
node assets\test-pptx.js my-document.standalone.html --theme dark --accent green
```

Pass the same `--theme` and `--accent` as the export being delivered.

This exports into `validation\pptx\<name>\`, renders every slide in desktop
PowerPoint through COM automation (read-only; the file is closed afterwards),
and compares it with Chromium's printed slide after a 2 px blur, letting every
pixel move by one render pixel (half a slide pixel). PowerPoint and Chromium
each snap text to their own device pixels, so such differences change with the
display resolution. Anti-aliasing and that snapping do not count; a misplaced,
rewrapped, or missing character or word does.

It fails when any 32 × 32 slide-pixel area, about a short word, differs on
more than 2% of its pixels. Exported decks and articles measure at most 0.4%.
On the example deck, erasing one character measured 4 to 19% and a word 26 to
31%; moving a whole slide by one slide pixel measures up to 30%, less where a
slide is nearly empty. It also checks the slide count, every title, the notes,
that text is native, and lists the fonts PowerPoint found. `report.json` lists
the worst area and the whole-slide percentage per slide. `diff\slideNN.png`
marks differences in red and tolerated sub-pixel edges in orange over the
PowerPoint render; `ppt\` and `ref\` hold both renders. Without desktop
PowerPoint on Windows the comparison is reported as skipped, not passed.

Then open the `.pptx` and look at every slide, as with a PDF: the numbers
prove geometry, not quality. Click into a few text boxes to confirm they edit.

## Limits

- The design is one picture per slide. Change boxes, diagrams, and images in
  the HTML and export again. Edited text does not move other elements, and
  edits never flow back into the HTML.
- PowerPoint can place a line up to about one rendered pixel from Chromium:
  it rounds line spacing to a whole percent and snaps every baseline to the
  display's pixels. Large multi-line headlines show it most; the verifier
  tolerates it, and it changes with the display resolution.
- Fonts with a typographic line gap, such as Gabriola, can sit slightly off
  vertically; the verifier reports it.
- No animation or transitions: every point is visible.
- Each slide picture is PNG, or JPEG at quality 92 when that is much smaller,
  as for photographs. A 16-slide text deck measures about 0.3 MB; a 15-slide
  deck with rendered illustrations about 1.6 MB; the 13-slide example with a
  photographic illustration on most slides about 7.5 MB.
