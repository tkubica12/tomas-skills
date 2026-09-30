---
name: html-docs
description: Create an HTML document that can be read in depth, presented as slides, and printed as a one-pager or datasheet, each exportable to PDF; or a slide-first browser deck. Use for HTML articles, reports, talks, browser slides, one-pagers, datasheets, PDF handouts, and shareable single-file documents.
license: MIT
metadata:
  version: "1.2.0"
---

# One document, up to three views

Build **one transferable HTML file** whose views share one argument at
deliberately different depths:

| View | For | Depth |
|---|---|---|
| **Read** (article) | The reader who wants the reasoning | Full prose, reveals with evidence |
| **Slides** | The room, during a talk | One claim and up to three short cues |
| **Sheet** | A skimming decision-maker, on paper | One-pager or datasheet with fixed pages |

Every view has a **PDF** form: the in-page **PDF** button prints the view on
screen, and `export-pdf.js` writes the exact files. Offer only the views the
document needs; a controls bar shows only those views.

## Choose the views

| Request | Shape | Runtime |
|---|---|---|
| Talk **and** detailed follow-up | **Article + Slides** — the preferred combined deliverable | `article.css/js`, `slides.css/js` |
| Analysis, design note, report, tutorial | **Article** (Read only) | Same; remove the Slides control |
| One-pager, datasheet, brief, leave-behind only | **Standalone sheet** | `sheet.template.html`, `sheet.css/js` |
| Document plus a one-page summary | **Article + companion Sheet**, optionally Slides | Adds `sheet.css/js` and the Sheet control |
| Slide-first talk, or a different narrative from any document | **Deck**, fixed 16:9 stage | `deck.css/js` |

Do not select a separate deck merely because the request says “talk” or
“presentation.” When people should read the details afterward, use article
slides mode. When the request does not make the views clear, **ask before
writing**: which of Read, Slides, and Sheet, and whether PDF files are
deliverables. Ask once, offering the likely combination as the recommended
choice. A request for only “a one-pager” or “a datasheet” means a standalone
sheet; add Read or Slides only when asked. Author a short `.slide-content` inside each card, alongside its
full `.card-body`; do not create a separate document or repeat the body on screen.

## Requirements

- All content lives in HTML. JavaScript adds interaction, never essential text.
  The whole document must remain readable with JavaScript disabled.
- No framework, CDN, runtime fetch, web font, or required network asset.
- Start from the appropriate template. Preserve its theme bootstrap and
  canonical inline tokens from `assets/tokens.css`; do not invent a palette.
- Black, white, grayscale, and **one accent at a time**: blue by default,
  red (red-orange), green, or yellow alternatives. Dark mode uses exact
  Microsoft logo colors; light mode uses the canonical darker counterparts
  for readable text. These light shades are this skill's design, not official
  Microsoft logo variants. Set `data-default-accent` on the document, never
  individual components. All views share the runtime accent control.
- Slides support the speaker: one claim, at most three short cues, no long
  prose, reveals, tabs, links, or other interactive content. Include an
  intentional opening and a memorable closing. Only optional point-by-point
  fragments animate; reduced motion reveals everything without animation.
- Sheets are paper: every `.sheet-page` fits exactly one page at full type
  size, with no interactive content. Overflow means shorter text or another
  page, never smaller type.
- Keep the **PDF** control. PDFs always use the light palette.
- Use the documented components. Do not modify shared CSS or JavaScript to
  accommodate one document; shorten or restructure its content instead.
- No emoji. Use CSS-drawn controls and arrows.
- Validate with a real browser before declaring completion.
- When sharing, sending, attaching, or a single file is requested, **build the
  standalone export automatically** and deliver that file, not an assets folder.
  When PDF is requested, also deliver the exported PDFs of the requested views.

Reading, presenting, and the PDF button need only a modern browser. Exporting
HTML needs Node.js (built-in modules only). Validation and `export-pdf.js`
additionally need Playwright and Chromium or a compatible installed browser;
see [validation](references/validation.md).

## Prepare

Use only the author's details, destination, and style requirements supplied for
this task. Do not insert a private default author, workplace, output path, or
personal configuration. Omit author/date fields when they are not relevant;
never manufacture provenance.

Keep an editable linked-assets source:

```text
document-folder/
  my-document.html
  assets/
    article.css  article.js
    slides.css   slides.js
    sheet.css    sheet.js
    deck.css     deck.js
    appearance.js  sync-head.js
    tokens.css   bundle.js   validate.js   export-pdf.js
    sample-diagram.svg
  LICENSE
```

From the destination folder, copy the installed skill's reusable assets and
license, then the appropriate template. Replace `<skill-folder>` with the
actual installation location:

```powershell
Copy-Item "<skill-folder>\assets" . -Recurse
Copy-Item "<skill-folder>\LICENSE" .
Copy-Item "<skill-folder>\article.template.html" "my-document.html"
```

For a standalone one-pager or datasheet, use
[sheet.template.html](sheet.template.html); for a slide-first deck,
[deck.template.html](deck.template.html). A repository can instead link
to an existing shared assets directory; relative paths resolve from the HTML
file, including during export.

## Author

1. **Plan the argument.** Choose chapter and card titles for an article, or
   slide titles for a deck. Titles assert claims; chapter labels are signposts.
2. **Write each depth intentionally.** Each `.slide-content` has at most
   45 words including diagram labels, one title, and at most three points of
   ten words each. Its `.card-body` explains the claim in prose; reveals hold
   evidence, assumptions, calculations, and alternatives. The reading body
   must stand alone without the presentation summary. Never squeeze it onto
   the slide. Keep one diagram or other substantial visual per slide. A sheet
   is written for paper: claim titles, short blocks, actions, a closing line,
   and footnoted sources; it never holds facts missing from the article.
3. **Read the relevant references before writing.**
   - [Design system](references/design-system.md): head, tokens, themes, SVGs.
   - [Article structure](references/article-structure.md): chapters, cards,
     stable IDs, depth, read progress.
   - [Components](references/components.md): exact component markup.
   - [Slides mode](references/slides-mode.md): authored cues and navigation.
   - [Sheet](references/sheet.md): one-pagers, datasheets, paper budget.
   - [PDF export](references/pdf-export.md): PDF button and exact files.
   - [Deck authoring](references/deck-authoring.md): slide-first layouts and
     fragments.
   - [Writing rules](references/writing-rules.md): direct prose and claim
     discipline.
4. **Start from the template and use the galleries.**
   [Article components](article.components.html) (including a companion
   sheet) and [deck components](deck.components.html) are local working
   references. Keep card numbers empty and IDs stable. Keep only the controls
   of the chosen views. Set a unique `doc-id` to scope theme, accent,
   animations, and read marks to this document.
5. **Check claims.** Identify assumptions and fictional examples explicitly.
   Give measured numbers their source and conditions; date time-sensitive
   claims. Do not invent benchmarks, quotations, or experience. Write
   explanatory prose, not narration about how the document was made.
6. **Validate source, then export and validate the deliverable.** Follow the
   [validation checklist](references/validation.md). Inspect screenshots in
   all eight light/dark × blue/red/green/yellow combinations, including opening,
   closing, diagram, and every sheet page at laptop and projector sizes. A
   slide must look spacious and a sheet composed, not merely pass an overflow
   check.

When canonical head assets change, synchronize sources before exporting:

```powershell
node assets\sync-head.js my-document.html
```

This copies `appearance.js` and `tokens.css` into the template's marked head
blocks. Never hand-edit those copies. `--check` detects stale copies.

## Export the file people receive

```powershell
node assets\bundle.js my-document.html
```

This generates `my-document.standalone.html`, including the document's full
CSS/JavaScript runtime and local media. An optional second argument sets the
output path. Edit the linked source, never the generated export.

For a shared talk and handout, **present this standalone file and send the
same file afterward**. Recipients toggle **Slides** for the live view or read
the identical chapter/card structure with deeper reveals. Node.js and
Playwright are not needed by recipients.

The exporter rejects unresolved local assets but does not download remote
assets. Remove required remote references before exporting. Ordinary external
citation links can remain; reading the document must not depend on opening
them. Links to other local documents do not travel with the file.

Validate the export in a fresh folder containing only that HTML and the
validator. Test with networking disabled and JavaScript disabled. A passing
source check does not prove the export is self-contained.

Preserve the MIT notice when redistributing the runtime. Include the notice
from `LICENSE` in an HTML comment in a single-file deliverable, so the notice
travels with it.

## Export PDFs

```powershell
node assets\export-pdf.js my-document.standalone.html
```

This writes one PDF per view the document offers: `my-document.pdf` for a
single view, otherwise `.document.pdf`, `.slides.pdf`, and `.sheet.pdf`.
It refuses to write a view whose pages clip or whose page count differs from
its slides or sheet pages. Open and inspect every PDF before delivering it.
Recipients can make the same PDFs themselves with the **PDF** button. See
[PDF export](references/pdf-export.md).

## Optional review in GitHub Copilot App

[Document review](https://github.com/tkubica12/tomas-skills/tree/main/extensions/document-review)
is a separately installed companion Canvas extension, not part of this skill
or a requirement for readers. It displays rendered local HTML in the app's
side panel so the user can select text, save comments, exact replacements, or
deletion requests, and explicitly send the annotations to the agent.

When the user requests an annotated review and the `document-review` canvas
is available, open the editable linked-assets HTML, not the generated
standalone export. Set `filePath` and `sourcePath` to the editable HTML and
`rootPath` to the smallest directory containing the preview and its linked
assets. Inspect the canvas input schema before opening it. A public URL alone
is not supported.

Annotations are requests, not immediate source edits. Wait for the user's
explicit handoff; inspect the source and anchors, apply only the requested
changes, and report ambiguous selections as blocked rather than guessing.
Rebuild and validate the standalone HTML and any requested PDFs, verify the
requested edits before recording `set_outcome`, then refresh the preview.
If the canvas is unavailable, do not install it automatically or block normal
authoring; point to the extension link when the user wants this review workflow.

## Handoff

Report the editable source, the shareable export, and any PDF paths; the
chapter/card, slide, and sheet-page counts; validation results; and any
deliberately omitted material. **Slides** and **Sheet** switch article views;
arrows/Space advance points; PageDown/PageUp skip whole slides; **Index** or
`O` jumps; `Escape` returns to reading. **PDF** prints the view on screen.
Presenting keeps the screen awake. All shapes have theme/accent controls.
Preferences stay local to the browser.
