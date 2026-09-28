# Sheets: one-pagers and datasheets

A sheet is a **fixed-page document**: a one-pager, datasheet, executive brief,
or leave-behind. Every `.sheet-page` is exactly one sheet of paper, so the
screen preview is the layout the PDF receives. Nothing reflows onto a second
page by accident.

## Two ways to use it

| Shape | Markup | Controls |
|---|---|---|
| **Standalone sheet** | `sheet.template.html`; the `.sheet` is the only content | PDF, Dark/Light, Accent |
| **Companion sheet** | `<section class="sheet">` after `.doc` in an article | adds **Sheet** beside Slides |

A companion sheet is a **third depth**: slide cues for the room, the sheet for
a skimming decision-maker, the article for the reader who wants the reasoning.
Write it for paper. Do not paste card bodies or slide cues into it, and do not
put facts only on the sheet; the article must remain complete. In a companion
sheet the title is an `h2`, because the article owns the `h1`. Without
JavaScript, a companion sheet stays hidden, like slide summaries.

**Sheet** switches the article to the paper preview; **Slides** or `Escape`
leaves it. `?view=sheet` links directly to it. Expand/collapse controls are
hidden while the sheet is shown.

## Page anatomy

```html
<section class="sheet" aria-label="Tokenomics one-pager">
  <article class="sheet-page" id="page-summary">
    <header class="sheet-head">
      <p class="sheet-kicker">CLIENT · PARTNER · TOPIC</p>
      <h1 class="sheet-title">Tokenomics.<br><em>Right-size the model.</em></h1>
      <p class="sheet-lead">Following our discussion: four workstreams.</p>
    </header>
    <div class="sheet-grid">
      <section class="sheet-block"><h3>Claim as a title</h3><p>Reason and evidence.<sup>1</sup></p></section>
      <!-- usually four blocks; sheet-grid--3 for three short columns -->
    </div>
    <aside class="sheet-actions" aria-label="Recommended actions">
      <h3>Recommended actions</h3>
      <ul><li>Concrete next step.</li></ul>
    </aside>
    <p class="sheet-close">The sentence to remember.</p>
    <footer class="sheet-notes"><p><sup>1</sup> Source, date, conditions.</p></footer>
  </article>
</section>
```

Components, all shown in the companion sheet of
[article components](../article.components.html):

| Class | Use |
|---|---|
| `sheet-kicker`, `sheet-title`, `sheet-lead` | Audience line, claim title (`<em>` for accent words), one-sentence lead |
| `sheet-grid` / `sheet-grid--3` | Two or three columns of `sheet-block`s, each a claim title plus a short paragraph |
| `sheet-stats` | Up to four key figures: `sheet-stat-value` and `sheet-stat-label` |
| `sheet-matrix` + `sheet-legend` | Comparison table; rows are reasons (`th scope="row"` with a `<span>` subtitle), columns are options |
| `mark` with `data-mark="full|part|none|plus|minus"` | Drawn cell marks. Give `role="img"` and `aria-label` in cells; `aria-hidden="true"` in the legend |
| `sheet-figure` | Inline SVG or image with `figcaption` |
| `sheet-actions` | Tinted box of recommended actions |
| `sheet-close` | Closing sentence |
| `sheet-notes` | Footnotes, pinned to the bottom of the page |
| `sheet-section-title` | Plain heading above a matrix or figure |

Every cell states its point in words; a mark summarizes, never replaces, it.

## Paper and budget

`data-paper="a4"` (default) or `"letter"` on `<html>` selects the paper for the
sheet and the reading PDF. Pages have 14–16 mm margins drawn inside the page.

- One page should carry one argument: a title, **four blocks or one matrix**,
  actions, and a closing line. Roughly 250–400 words is a full A4 page.
- Text never shrinks to fit. The smallest text is **7.5 pt**, for notes only;
  body text is 10.5 pt. When a page overflows, cut words or add a page.
- No reveals, tabs, buttons, or media: paper has no interaction. Links may
  stay; they remain clickable in the PDF.
- Numbered claims get a footnote with source and date, as in an article.

The runtime warns in the console when a page overflows its paper. The
validator fails it, checks the text floor and mark labels, and confirms the
PDF has exactly one page per `.sheet-page`. See [PDF export](pdf-export.md).
