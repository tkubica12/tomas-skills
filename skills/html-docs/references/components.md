# Components

This is the markup contract. The CSS and the runtime key off these exact
structures; a deviating structure produces unstyled or non-functional controls.
Do not invent classes and do not add wrapper elements between the ones shown.

Every component below is rendered live in
`article.components.html`. Open that file in a browser rather
than working from memory. The deck subset is in
`deck.components.html`.

| Component | Article | Deck |
|---|---|---|
| reveal | reading only | no |
| tabs | yes | no |
| detail grid | yes | no |
| sequence | yes | yes |
| steps | yes | yes |
| summary grid | yes | yes |
| arrow list | yes | yes |
| callouts | yes | yes |
| code | yes | yes |
| figure with lightbox | yes | figure only, no lightbox |
| closing takeaway | yes | use `slide--end` |
| two columns, quote, table | no | yes |

## Reveal

Progressive disclosure inside a reading card, never a slide. The default state is closed;
add `data-open` to the `.reveal` and `aria-expanded="true"` to the toggle when
it should start open.

```html
<div class="reveal">
  <button type="button" class="reveal-toggle" aria-expanded="false">Show the evidence</button>
  <div class="reveal-body">
    <p>Depth lives here.</p>
  </div>
</div>
```

The toggle label says what is inside, not "more". "Show the full Bicep file",
"Show why the first approach failed", "Show the raw output".

Reveals nest one level. Two levels of nesting means the card should be split.

## Tabs

Alternative paths to the same outcome: portal, CLI, SDK. Not a way to hide
unrelated content.

```html
<div class="tabs">
  <div class="tablist" role="tablist" aria-label="Ways to create the resource">
    <button type="button" role="tab" id="tab-portal" aria-controls="panel-portal" aria-selected="true">Portal</button>
    <button type="button" role="tab" id="tab-cli" aria-controls="panel-cli" aria-selected="false" tabindex="-1">CLI</button>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-portal" aria-labelledby="tab-portal" data-tab-label="Portal">
    ...
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-cli" aria-labelledby="tab-cli" data-tab-label="CLI" hidden>
    ...
  </div>
</div>
```

Required, and easy to get wrong:

- Exactly one tab has `aria-selected="true"` and no `tabindex`. Every other tab
  has `aria-selected="false"` and `tabindex="-1"`. The runtime then manages a
  roving tabindex, and arrow keys move between tabs.
- Every panel carries `data-tab-label`. With JavaScript disabled all panels are
  shown, and that attribute renders as the heading above each one so the
  content is still labelled. Omit it and the no-JS rendering becomes an
  unlabelled pile.
- Panels other than the selected one carry `hidden`.

Two to four tabs. More than four means the material wants a table.

## Detail grid

A comparison surface: several dimensions, each with a one-line verdict and a
longer explanation behind a click. The explanation opens in a modal dialog.

```html
<div class="detail-grid">
  <div class="detail-tile">
    <button type="button" class="detail-open">
      <span class="detail-title">Cost</span>
      <span class="detail-summary">Predictable at steady state, spiky during migration.</span>
      <span class="detail-more" aria-hidden="true">Details</span>
    </button>
    <div class="detail-body">
      <p>The long form.</p>
    </div>
  </div>
</div>
```

The runtime moves `.detail-body` into the dialog on open and puts it back on
close, so the content exists exactly once in the DOM and is present with
JavaScript disabled.

`.detail-summary` must stand alone. A reader who never opens a tile should
still get the comparison.

## Sequence

An ordered progression where the order carries meaning: a spectrum, an
evolution, a maturity ladder. Rendered inline with arrows between items.

```html
<ol class="sequence">
  <li><span class="seq-title">Virtual machines</span><span class="seq-note">Full control, full responsibility.</span></li>
  <li><span class="seq-title">Containers</span><span class="seq-note">Portable units, orchestrated.</span></li>
</ol>
```

Three to five items. `.seq-note` is optional but should be present or absent
consistently across the whole list.

## Steps

Instructions to follow in order. Numbered, stacked, each with a heading and a
short body.

```html
<ol class="steps">
  <li>
    <h4>Provision</h4>
    <p>Create the resource group and the workload identity.</p>
  </li>
</ol>
```

Both `h3` and `h4` are styled; pick the one that fits the surrounding heading
level and stay consistent within a document.

Use steps for procedure, sequence for concept. Do not mix them in one list.

## Summary grid

Two to six labelled takeaways, used to close a chapter or an argument.

```html
<div class="summary-grid">
  <div class="summary-item">
    <span class="summary-label">Latency</span>
    Median request time drops once the cold start is removed.
  </div>
</div>
```

The label is one or two words. The body is one sentence with a verb in it, not
a fragment.

## Arrow list

Consequences, recommendations, or next actions. The arrow is drawn by CSS;
never type one.

```html
<ul class="arrow-list">
  <li>Move the build to the pipeline before touching the runtime.</li>
</ul>
```

Use a plain `<ul>` for a list that is merely a list. The arrow list means
"these follow from the above".

## Callouts

Six meanings, no more. Every callout carries a `.callout-label` naming its
meaning, and every one takes a modifier class so the intent is explicit in the
markup.

```html
<aside class="callout callout--rule">
  <p class="callout-label">Rule</p>
  <p>A durable rule to remember.</p>
</aside>
```

| Modifier | Label | Meaning |
|---|---|---|
| `callout--note` | Note | An aside that does not change the argument |
| `callout--rule` | Rule | A durable rule the reader should carry away |
| `callout--warning` | Warning | A real risk, or a way to break something |
| `callout--verdict` | Verdict | The author's judgement, stated as a judgement |
| `callout--source` | Source | Provenance: link, version, date, measurement conditions |
| `callout--author` | Author | First-person context or experience |

At most one callout per card, and at most one per slide. A page of callouts is
a page with no emphasis. Warning labels use the current accent, not a separate
red or yellow palette.

## Code

```html
<div class="code">
  <p class="code-label">infra/main.bicep</p>
  <pre><code>...</code></pre>
</div>
```

`.code-label` is optional and holds either a language or a file path; pick one
convention per document. There is no syntax highlighting, by design: no
highlighter means no dependency and no half-correct colouring of a language the
highlighter does not know.

Escape `<`, `>`, and `&` inside `<code>`. Keep code blocks short. A full file
belongs behind a reveal.

## Figures

```html
<figure class="figure">
  <a class="zoom" href="diagram.svg">
    <img src="diagram.svg" alt="Source feeds processing, which writes to a sink." width="1600" height="900">
  </a>
  <figcaption>Data path from source through processing to sink.</figcaption>
</figure>
```

- `width` and `height` are required. Without them the page reflows as images
  load, which is visible and avoidable.
- `alt` describes what the figure shows, in a sentence. It is not the caption
  repeated and it is not "diagram".
- Wrapping the `img` in `a.zoom` enables the lightbox: click to open, `+` / `-`
  / `0` to zoom, drag to pan, pinch on touch, `Escape` to close. The `href`
  points at the full-size asset. Without JavaScript the anchor is an ordinary
  link to the image, which is the correct fallback.
- Prefer SVG. An SVG loaded through `<img>` is a *separate document*: it cannot
  see `currentColor` or the page's custom properties, so it will not theme with
  the page unless you give it its own internal `<style>`. See "Diagrams" in
  `design-system.md` for the pattern that does work.
- Trim the `viewBox` to the drawing before shipping it. The browser fits an
  image by whichever axis binds first, so empty space inside the `viewBox`
  shrinks the whole diagram inside its frame. Keep `width`/`height` on the
  `img` in sync with the trimmed `viewBox`.

## Closing takeaway

One sentence that closes the article, after the last chapter. The template
places it immediately after `main`; slides mode discovers either placement.

```html
<section class="takeaway" id="closing">
  <p>The deployment path, not the platform, was the constraint.</p>
  <div class="slide-content slide-content--end">
    <h2 class="slide-title">Fix the path.<br><em>Not the platform.</em></h2>
  </div>
</section>
```

Exactly one per article. The reading sentence closes the argument; the
authored surface gives the presenter a short final message. See
[slides mode](slides-mode.md) for the surface contract.

## Deck-only components

`two-col` with `col-label`, `quote` with `quote-attrib`, and plain `<table>`
are styled by `deck.css` only. Their markup is in
`deck.components.html`. See
[`deck-authoring.md`](deck-authoring.md).
