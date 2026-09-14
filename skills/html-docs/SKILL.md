---
name: html-docs
description: Create an HTML document that doubles as a live presentation and detailed handout, or a slide-first browser deck. Use for HTML articles, reports, talks, browser slides, and shareable single-file documents.
license: MIT
---

# One document, two ways to use it

Build **one transferable HTML file with two deliberately different depths**:
concise speaker cues for presenting, and explanatory prose for reading.
Both follow the same chapters and cards in the same order. After the meeting,
listeners receive that file and open the evidence behind each point.

## Choose the shape

| Need | Shape | Runtime |
|---|---|---|
| Live presentation **and** detailed document or follow-up handout | **Article with slides mode** — the preferred combined deliverable | `article.css/js` + `slides.css/js` |
| Analysis, design note, briefing, tutorial, report | **Article**, optionally with slides mode | Same assets; omit Slides control for reading only |
| Explicitly slide-first talk, or a presentation with a different narrative from the document | **Deck**, fixed 16:9 stage | `assets/deck.css` + `assets/deck.js` |

Do not select a separate deck merely because the request says “talk” or
“presentation.” When people should read the details afterward, use article
slides mode. Author a short `.slide-content` inside each card, alongside its
full `.card-body`; do not create a separate document or repeat the body on screen.

## Requirements

- All content lives in HTML. JavaScript adds interaction, never essential text.
  The whole document must remain readable with JavaScript disabled.
- No framework, CDN, runtime fetch, web font, or required network asset.
- Start from the appropriate template. Preserve its theme bootstrap and
  canonical inline tokens from `assets/tokens.css`; do not invent a palette.
- Black, white, grayscale, and **one accent at a time**: blue by default,
  orange or green alternatives. Set `data-default-accent` on the document,
  never individual components. Both views share the runtime accent control.
- Slides support the speaker: one claim, at most three short cues, no long
  prose, reveals, tabs, links, or other interactive content. Include an
  intentional opening and a memorable closing. Only optional point-by-point
  fragments animate; reduced motion reveals everything without animation.
- Use the documented components. Do not modify shared CSS or JavaScript to
  accommodate one document; shorten or restructure its content instead.
- No emoji. Use CSS-drawn controls and arrows.
- Validate with a real browser before declaring completion.
- When sharing, sending, attaching, or a single file is requested, **build the
  standalone export automatically** and deliver that file, not an assets folder.

Reading and presenting need only a modern browser. Exporting needs Node.js
(built-in modules only). Validation additionally needs Playwright and Chromium
or a compatible installed browser; see [validation](references/validation.md).

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
    deck.css     deck.js
    appearance.js  sync-head.js
    tokens.css   bundle.js   validate.js
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

For a slide-first deck, use [deck.template.html](deck.template.html). A repository can instead link
to an existing shared assets directory; relative paths resolve from the HTML
file, including during export.

## Author

1. **Plan the argument.** Choose chapter and card titles for an article, or
   slide titles for a deck. Titles assert claims; chapter labels are signposts.
2. **Write both depths intentionally.** Each `.slide-content` has at most
   45 words including diagram labels, one title, and at most three points of
   ten words each. Its `.card-body` explains the claim in prose; reveals hold
   evidence, assumptions, calculations, and alternatives. The reading body
   must stand alone without the presentation summary. Never squeeze it onto
   the slide. Keep one diagram or other substantial visual per slide.
3. **Read the relevant references before writing.**
   - [Design system](references/design-system.md): head, tokens, themes, SVGs.
   - [Article structure](references/article-structure.md): chapters, cards,
     stable IDs, depth, read progress.
   - [Components](references/components.md): exact component markup.
   - [Slides mode](references/slides-mode.md): authored cues and navigation.
   - [Deck authoring](references/deck-authoring.md): slide-first layouts and
     fragments.
   - [Writing rules](references/writing-rules.md): direct prose and claim
     discipline.
4. **Start from the template and use the galleries.**
   [Article components](article.components.html) and
   [deck components](deck.components.html) are local working references.
   Keep card numbers empty and IDs stable. Keep the article's **Slides**
   control for a combined talk and handout. Set a unique `doc-id` to scope
   theme, accent, animations, and read marks to this document.
5. **Check claims.** Identify assumptions and fictional examples explicitly.
   Give measured numbers their source and conditions; date time-sensitive
   claims. Do not invent benchmarks, quotations, or experience. Write
   explanatory prose, not narration about how the document was made.
6. **Validate source, then export and validate the deliverable.** Follow the
   [validation checklist](references/validation.md). Inspect screenshots in
   all six light/dark × blue/orange/green combinations, including opening,
   closing, and diagram at laptop and projector sizes. A slide must look
   spacious, not merely pass an overflow check.

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

## Handoff

Report the editable source and shareable export paths, chapter/card or slide
count, validation results, and any deliberately omitted material. **Slides**
toggles article views; arrows/Space advance points; PageDown/PageUp skip whole
slides; **Index** or `O` jumps; `Escape` returns to reading. Both shapes have
theme/accent and **Animations** controls. Preferences stay local to the browser.
