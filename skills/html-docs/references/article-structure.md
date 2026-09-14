# Article structure

An article is a reading canvas. The reader arrives, sees the whole shape, and
chooses their own depth. Nothing is hidden that they need; nothing is forced on
them that they do not.

## Page shape, in order

```
controls          fixed: expand/collapse / slides / theme / accent / read marks
.doc              the 1160px canvas
  header          reading introduction + concise opening .slide-content
  nav             optional links to sibling documents
  toc             contents, once the article has more than about three chapters
  main
    .chapter      one per major section
      .card       concise .slide-content + reading header/body, one idea
  .takeaway       reading conclusion + concise closing .slide-content
  footer          optional author and provenance
```

`article.template.html` contains exactly this. Start from it.

## Chapters

A chapter is a `<section class="chapter" id="ch-...">` whose first child is
`<h2 class="chapter-label">`.

- Give every chapter a stable `id` prefixed `ch-`. It is the anchor, the TOC
  target, and the slide divider.
- Three to seven chapters is the usable range. Fewer means the article is
  really one chapter. More means it is really two articles.
- The chapter label is a noun phrase naming the territory. It is the only place
  in the document where a heading is allowed to be purely descriptive rather
  than assertive, because it is a signpost.

## Cards

A card is one idea. It is the atom of the article: the unit that collapses, the
unit that gets a number, and the unit that becomes a slide.

```html
<article class="card" id="card-slug">
  <div class="slide-content">
    <h2 class="slide-title">A concise speaker cue</h2>
    <p class="slide-lead">One short supporting line.</p>
  </div>
  <h3 class="card-head">
    <button type="button" class="card-toggle" aria-expanded="false">
      <span class="card-num" aria-hidden="true"></span>
      <span class="card-titles">
        <span class="card-title">Assertive title</span>
        <span class="card-sub">Optional line that stays visible while collapsed.</span>
      </span>
      <span class="card-mark" aria-hidden="true"></span>
    </button>
  </h3>
  <div class="card-body">
    ...
  </div>
</article>
```

Rules:

- **`.card-num` is left empty.** Numbers are generated. In the article they
  come from a CSS counter across the document; the runtime freezes the
  resolved number into the DOM on load so that slides mode does not renumber
  anything. Never type a number into the markup.
- **`aria-expanded` on the button must match `data-open` on the card.** The
  runtime maintains both after the first interaction, but the initial state is
  authored, so get it right or the page announces the wrong thing to a screen
  reader before the first click.
- **The card `id` is a permalink.** Prefix it `card-` and keep it stable across
  revisions; people link to cards.
- **One card, one idea.** If the title needs "and", split the card.

### The lead card

The first card of the first chapter is usually
`class="card card--lead"` with `data-open` and `aria-expanded="true"`. It is
unnumbered and open on arrival, so the reader lands on prose rather than on a
wall of closed rows.

Use at most one lead card per chapter, and usually only in the first chapter.

### Card subtitles

`.card-sub` stays visible when the card is collapsed. Use it when the title
alone does not let a reader decide whether to open the card. It is not a
second title; it is the answer to "why would I open this?".

## Choosing depth

For every card, assign its live cue and reading depth before writing HTML.

| Bucket | Where it goes | Test |
|---|---|---|
| Speaker cue | Direct child `.slide-content` | A claim and short points, not the reading paragraphs |
| Spine | The card body, above any reveal | A reader who reads only this still gets the argument |
| Depth | Inside a `.reveal` | Evidence, derivation, full output, alternatives, caveats |
| Cut | Nowhere | It is context the reader already has, or it belongs in another document |

The most common failure is putting spine material behind a reveal because the
card looks long. If the card is too long, it is two cards.

The second most common failure is keeping cut material "just in case". Cut it,
and say in the report to the user what you cut.

## Table of contents

Add `nav.toc` once there are more than about three chapters. It lists chapters
only, never cards. It is a `<nav class="toc">` containing an `<ol>` of anchors
to `#ch-` ids. The runtime marks the entry for the chapter currently in view.

## Header and footer

The header carries an eyebrow (a short category, uppercase), the `h1`, a
subtitle of one or two sentences saying what the reader gets and who it is for,
and, when relevant, a `<time datetime="...">`. Supply an accurate machine-readable
`datetime` whenever using a date; omit dates that do not serve the content.

The footer can carry a supplied author and provenance that applies to the whole
document. Do not invent either. Per-claim provenance belongs in a `source`
callout next to the claim, not in the footer.

## Deep links

Every chapter and card `id` is addressable. On load the runtime opens the card
named in the hash, expands its ancestors, and scrolls to it. This is why ids
must be stable and human-readable: `#card-cost-model`, not `#card-7`.

## Read progress

The runtime tracks which cards the reader has actually read and shows a small
accent check in the card header once a card is done. The controls bar carries a
**Clear marks** button. Nothing is authored for this — it works on any article.

A card counts as read when it is **open** and has been **visible for about a
second**: half of it on screen for a short card, or the bottom edge reached for
a card taller than the viewport. Opening a card and immediately scrolling past
it does not count, and neither does presenting: read tracking is suspended in
slides mode, where the current card fills the viewport by construction.

State lives in `localStorage` per document and per card id. Two authoring
consequences follow:

- **Give every card a stable, authored `id`.** Cards without one are keyed by
  position, so inserting a chapter mid-document shifts everyone's marks. This
  is the same reason ids must be stable for deep links, now with a second
  payoff.
- **Add `<meta name="doc-id" content="...">` in the head** if the document may
  be served from more than one path. Without it the storage key is derived from
  the pathname, so a reader who opens the same article from a different URL
  starts over.

Read marks are a reader convenience, not analytics: nothing leaves the browser.
Say so if a reader asks.

## Length

An article that needs more than roughly seven chapters or more than roughly
thirty cards is two articles. Split it and link them with `nav.doc-nav`, rather
than shipping something no one finishes.
