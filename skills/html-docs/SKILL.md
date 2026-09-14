---
name: html-docs
description: Create an HTML document that doubles as a live presentation and detailed handout, or a slide-first browser deck. Use for HTML articles, reports, talks, browser slides, and shareable single-file documents.
license: MIT
---

# One document, two ways to use it

Build a readable HTML document with progressive disclosure and a presentation
view over **the same content, in the same order**. After the meeting, listeners
receive the same file and open the explanations behind each point. There is no
second narrative to keep synchronized.

## Choose the shape

| Need | Shape | Runtime |
|---|---|---|
| Live presentation **and** detailed document or follow-up handout | **Article with slides mode** — the preferred combined deliverable | `assets/article.css` + `assets/article.js` |
| Analysis, design note, briefing, tutorial, report | **Article**, optionally with slides mode | Same article runtime |
| Explicitly slide-first talk, or a presentation with a different narrative from the document | **Deck**, fixed 16:9 stage | `assets/deck.css` + `assets/deck.js` |

Do not select a separate deck merely because the request says “talk” or
“presentation.” When people should read the details afterward, use article
slides mode. Do not duplicate the article into a second set of slides.

## Requirements

- All content lives in HTML. JavaScript adds interaction, never essential text.
  The whole document must remain readable with JavaScript disabled.
- No framework, CDN, runtime fetch, web font, or required network asset.
- Start from the appropriate template. Preserve its theme bootstrap and
  canonical inline tokens from `assets/tokens.css`; do not invent a palette.
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
    deck.css     deck.js
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
2. **Separate the live argument from its depth.** Each article card carries one
   concise point. Evidence, assumptions, worked calculations, and alternatives
   go in reveals under that same point. Essential reasoning stays on the
   surface. A full-width figure gets its own card.
3. **Read the relevant references before writing.**
   - [Design system](references/design-system.md): head, tokens, themes, SVGs.
   - [Article structure](references/article-structure.md): chapters, cards,
     stable IDs, depth, read progress.
   - [Components](references/components.md): exact component markup.
   - [Slides mode](references/slides-mode.md): article presentation and fitting.
   - [Deck authoring](references/deck-authoring.md): slide-first layouts and
     fragments.
   - [Writing rules](references/writing-rules.md): direct prose and claim
     discipline.
4. **Start from the template and use the galleries.**
   [Article components](article.components.html) and
   [deck components](deck.components.html) are local working references.
   Keep card numbers empty and IDs stable. Keep the article's **Slides**
   control for a combined talk and handout.
5. **Check claims.** Identify assumptions and fictional examples explicitly.
   Give measured numbers their source and conditions; date time-sensitive
   claims. Do not invent benchmarks, quotations, or experience. Write
   explanatory prose, not narration about how the document was made.
6. **Validate source, then export and validate the deliverable.** Follow the
   [validation checklist](references/validation.md). Inspect screenshots in
   light/dark themes and presentation mode, including the longest card and
   diagram at laptop and projector sizes. Fix overflow by restructuring.

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
count, validation results, and any deliberately omitted material. For article
slides: **Slides** toggles views; arrows advance; **Index** or `O` jumps;
`Escape` returns to reading. Dark/light theme and read marks stay local to the
browser. Decks additionally support fragments and the **Animations** toggle.
