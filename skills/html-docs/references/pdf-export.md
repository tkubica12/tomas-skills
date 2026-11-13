# PDF export

Every view has a PDF form, printed through dedicated print stylesheets:

| View on screen | PDF |
|---|---|
| Reading (article) | Full reference, A4 or Letter portrait, page numbers, all reveals open |
| Slides (article) or deck | One 16:9 page per slide, including dividers; every point shown |
| Sheet | Exactly one page per `.sheet-page` |

PDFs default to the **light palette**, even from a dark screen. Dark printing
is a separate explicit choice, supported in Read, article Slides, Deck, and
standalone or companion Sheet. Both palettes retain the selected accent family
with its matching light/dark shade. Controls, navigation, and duplicate
summaries are never printed.

## In the document: the PDF button

**PDF** prints whatever is on screen. `Ctrl+P` does the same. It needs no
server, network, or installation, and works from a local file:

1. The reader chooses the view (reading, Slides, or Sheet), optionally changes
   **PDF theme: Light** to **Dark**, then clicks **PDF**.
2. In the print dialog they choose **Save as PDF** as the destination.
3. The proposed file name is the document title, with ` - Slides` or
   ` - Sheet` for a non-reading view.

Chrome and Edge render the result closest to the automated export. Page
sizes come from CSS: keep the scale at its default and **Background graphics**
enabled if the dialog offers them. Firefox and Safari print the same content
with small typographic differences. A browser cannot save a PDF silently; the
print dialog is always shown.

Without JavaScript, printing produces the reading reference, or the sheet for a
standalone sheet; a deck prints all slides. An authored `data-print-theme`
works without JavaScript too.

### Explicit print palette

Screen **Dark / Light** never changes the print palette. Choose one of:

- **Author:** set `data-print-theme="dark"` on `<html>` (omit it for light).
- **Reader/operator:** the **PDF theme** control or `?print-theme=dark` selects
  dark printing; `light` explicitly selects light. Like appearance preferences,
  the control persists locally per document. URL overrides take precedence over
  saved choices, which take precedence over the authored value. No system-dark
  preference opts a document into dark printing.
- **Exporter:** `--theme light` or `--theme dark` overrides the document's print
  choice for that run without changing its source. Without the flag it honors
  the authored choice; a fresh offline context has no saved reader preference.

Dark printing needs **Background graphics** enabled. It uses canonical dark
surfaces and text, including reading-page margins and page numbers, rather than
an injected per-document stylesheet. For ink-saving print choose light.

## From the skill: exact files

```powershell
node assets\export-pdf.js my-document.html
node assets\export-pdf.js my-document.standalone.html --out out --only sheet
node assets\export-pdf.js my-document.standalone.html --theme dark --out dark-pdf
node assets\export-pdf.js my-document.standalone.html --theme light --out light-pdf
```

A document with one view writes `my-document.pdf`. A document with several
views writes `my-document.document.pdf`, `.slides.pdf`, and `.sheet.pdf`.
A `.standalone` suffix is dropped from the name. `--only` selects views.
Use separate output folders to retain both palettes; names are deliberately
unchanged. Invalid themes, incomplete options, or unoffered views fail explicitly.

The exporter uses Playwright and Chromium, like the validator. It loads the
page offline, waits for images and fonts, prints each view with CSS page sizes,
backgrounds, a tagged structure, and bookmarks from headings, then checks:

- every slide surface or sheet page fits without clipping;
- the page count equals the number of slides or sheet pages;
- the page loaded without errors or network requests.

A failing view writes no file. Shorten or split the content; never lower the
type size to force a fit.

## Review

Page counts and fit prove geometry, not quality. Open every PDF and look at
each page: a sheet must look composed, with no orphaned headings; slide pages
must match the presented slides; the reading PDF must not strand a heading at
the bottom of a page. Inspect actual light and dark PDFs when both are requested,
including dark page edges, page numbers, accent, diagrams, and cropped subjects.
Page counts must agree between palettes. Deliver PDFs beside the standalone HTML when they are
requested; recipients who cannot open HTML attachments still get the content.

When a `.pptx` is requested instead of or beside the slides PDF, see
[PowerPoint export](pptx-export.md).
