# Deck authoring

A deck is slide-first. It has its own runtime (`deck.css`, `deck.js`) and
shares only the design tokens and the component vocabulary with the article.

Build a deck when the user explicitly wants a slide-first deliverable or a
different narrative from the document. For a live talk and a detailed follow-up
with identical structure, prefer an article with slides mode — see
[`slides-mode.md`](slides-mode.md).

## The stage

Every slide is authored inside a fixed **1280 x 720** box:

```html
<main class="deck-stage">
  <section class="slide" id="s-thing"> ... </section>
</main>
```

The runtime scales that box by `min(vw/1280, vh/720)` and letterboxes the
remainder. Consequences:

- **What fits in the box fits on any screen.** There is no responsive layout to
  reason about and no "it looked fine on my laptop".
- **Do not set pixel sizes relative to the viewport.** Author in the 1280 x 720
  coordinate space; `deck.css` uses absolute pixel type sizes on purpose.
- **Do not add a slide outside `.deck-stage`.** It will not be scaled or
  navigated.

Give every slide a stable `id` prefixed `s-`. Without one the runtime assigns
`slide-N`, which is fine functionally but produces a meaningless URL and a
meaningless entry in the slide index.

## Slide types

| Class | Use | Contents |
|---|---|---|
| `slide slide--title` | Opening | `h1`, `p.slide-sub`, `p.slide-meta` |
| `slide slide--section` | Part divider | `h2`, optional `p.slide-lead` |
| `slide` | Content | `.slide-head` + `.slide-body` + optional `p.slide-note` |
| `slide slide--end` | Closing | One `p` |

The content slide is the workhorse:

```html
<section class="slide" id="s-first-point">
  <div class="slide-head">
    <h2 class="slide-title">The point of this slide</h2>
    <p class="slide-lead">Optional supporting line.</p>
  </div>
  <div class="slide-body">
    ...
  </div>
  <p class="slide-note">Optional footnote, source, or date.</p>
</section>
```

`.slide-body` is the element that gets shrunk when content overflows, so
everything that can overflow must be inside it. `.slide-head` and
`.slide-note` stay at full size.

## The title is the point

`.slide-title` states the conclusion of the slide, not its topic. "Cutover
risk sits in the rollback path", not "Rollback". If a reader photographs one
slide, the title should carry the claim.

A section divider is the one exception: it is a signpost, so a noun phrase is
correct there.

## Components on slides

The shared vocabulary is available: `arrow-list`, `summary-grid`, `sequence`,
`steps`, `callout` (all six modifiers), `code`, `figure`, and `reveal`. Their
markup is identical to the article and documented in
[`components.md`](components.md).

Deck-only additions:

```html
<div class="two-col">
  <div>
    <span class="col-label">Before</span>
    <ul><li>...</li></ul>
  </div>
  <div>
    <span class="col-label">After</span>
    <ul><li>...</li></ul>
  </div>
</div>
```

```html
<blockquote class="quote">
  The constraint was never the platform. It was the deployment path.
  <span class="quote-attrib">Platform lead, migration retrospective</span>
</blockquote>
```

Plain `<table>` with `<thead>` and `<tbody>` is styled. Keep it to about four
columns and six rows; anything larger is a handout, not a slide.

Tabs and the detail grid are deliberately **not** available on a deck. Both
require the audience to click, which no audience does.

## Fragments

Add `class="frag"` to any element that should appear on its own advance.

```html
<ul class="arrow-list">
  <li class="frag">First idea.</li>
  <li class="frag">Second idea.</li>
</ul>
```

Fragments are dimmed until revealed rather than removed, so nothing shifts
position as you advance. Advancing past the last fragment moves to the next
slide; going back re-hides them one at a time, and arriving at a slide
backwards shows all of its fragments.

Use fragments to control pacing on a list of claims. Do not fragment a diagram,
a code block, or anything the audience needs to read as a whole.

### Animations on or off

Fragment-by-fragment pacing is right for a live talk and wrong for almost
everything else: a self-guided reader, a recording someone will scrub through,
or a rehearsal where you want to see each slide whole.

The **Animations** button in the controls bar switches between them, and `A`
does it from the keyboard. On (the default, and shown highlighted) means one
advance reveals one fragment. Off means every fragment is visible immediately
and one advance moves a whole slide. Turning animations back on restarts the
build on the current slide, so you can drop back into stepped pacing mid-talk
without leaving the slide.

The button's label never changes — only its pressed styling does. A control
whose text changes with its state resizes the whole pill on every press, which
is more distracting than the setting is important.

The choice is stored in `localStorage` under `doc-reveal` and is deliberately
*not* scoped to one document — a presenter who prefers whole slides gets them
everywhere. Author as if animations are on, since that is what a first-time
viewer sees.

## Reveals on a slide

A `.reveal` on a slide is for the question you expect but do not want to
pre-empt: the full command output, the exception trace, the detailed numbers.
It is opened by the presenter, not by the audience, and re-fits the slide when
it opens.

## Presenting

- Forward: `Right`, `PageDown`, `Space`, click, swipe left.
- Back: `Left`, `PageUp`, swipe right.
- Ends: `Home`, `End`.
- Slide index: `O`, or the **Slides** button. It lists every slide with its
  number and marks the current one. Click an entry to jump.
- Reveal mode: `A`, or the **Animations** button. See *Animations on or off*
  above.
- Full screen: `F` or the button.
- Theme: the toggle in the controls bar; also `?theme=dark` in the URL.

The current slide id is kept in the URL hash, so a specific slide is linkable
and survives reload. Changing the hash navigates.

The chrome fades out until hovered or focused, so it does not appear in a
recording or a screenshot of the projected slide. It is held up for a few
seconds on load, and any mouse movement lifts it again briefly — that is how a
presenter who does not know it is there discovers it.

## Fitting

`.slide-body` is measured on every navigation. If it overflows, the runtime
shrinks it with CSS `zoom`, starting from `available / needed` and then stepping
down until it genuinely fits, clamped at `0.62`. The first computed ratio is not
trusted on its own: margins between blocks and sub-pixel rounding survive the
scale, so a single guess can leave a few pixels clipped. When the clamp is
reached and the slide still does not fit, the runtime writes:

```
html-docs: slide content overflows at readable size. Split this slide: #s-...
```

That is a defect. Split the slide. A deck with fifteen readable slides beats
one with nine crowded ones.

### One heavy block per slide

The reliable way to never see that warning is to budget the slide before
writing it. Treat a code block, a table, and a figure as *heavy*: each one
alone fills most of a 1280x720 stage.

- One heavy block per slide, at most.
- Around it, room for a title, a lead line, and **either** a short list **or**
  one callout — not both.
- Two heavy blocks on one slide is always a split, even if the fit algorithm
  rescues it. A rescued slide is a shrunken slide.

When a slide needs both a command and the parameters that command takes, the
command is one slide and the parameter table is the next. That reads better
anyway: the audience sees the shape first and the detail second.

## Without JavaScript

Every slide is present in the HTML and stacks vertically as a scrollable
document, reveals open, fragments at full opacity. That is the fallback and it
must stay readable — check it, because it is also roughly what a text extractor
and a print stylesheet see.

## Printing

`deck.css` prints one landscape page per slide with the chrome removed. Use
`page.pdf({ landscape: true })` when the user wants a PDF handout, and read it
before sending: fragments print revealed, which is usually right for a handout
and occasionally a surprise.

## Length

One idea per slide. If a slide has two claims, it is two slides. A 30-minute
session is roughly 20 to 30 slides with this density, and that is fine — slide
count is not a cost when each one is a single beat.
