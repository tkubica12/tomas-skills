# Standalone decks

Use a deck for a slide-first deliverable or a genuinely different narrative.
For a talk plus a detailed reference with the same structure, prefer
[article slides](slides-mode.md). Decks use `deck.css/js` and the shared
appearance bootstrap and tokens.

## Stage and types

Slides are authored on a 1280 x 720 stage, scaled to the viewport with
letterboxing. Give every slide a stable `s-...` ID and keep it inside
`<main class="deck-stage">`. Start from `deck.template.html`.

| Class | Contents |
|---|---|
| `slide slide--title` | One `h1`, short `p.slide-sub`, optional supplied metadata |
| `slide slide--section` | `h2`, optional `p.slide-lead` |
| `slide` | `.slide-head`, `.slide-body`, optional `p.slide-note` |
| `slide slide--end` | One memorable closing message |

```html
<section class="slide" id="s-headroom">
  <div class="slide-head">
    <h2 class="slide-title">Recovery needs spare capacity</h2>
  </div>
  <div class="slide-body">
    <ul class="arrow-list">
      <li class="frag">New work keeps arriving.</li>
      <li class="frag">Backlog competes for the same workers.</li>
    </ul>
  </div>
</section>
```

## Density and composition

One idea, at most **65 words**, and preferably no more than three short points
per slide. The title states the claim. Open with an intentional title, not an
agenda wall; end with the sentence the audience should remember.

Use one substantial block: a diagram, small table, code excerpt, or comparison.
Do not combine a table and code or crowd several callouts around a figure.
Long explanations belong in an article, not an interactive slide.

Available static components: `arrow-list`, `summary-grid`, `sequence`, `steps`,
`callout`, `code`, `figure`, plus deck-only `two-col`, `quote`, and plain tables.
The gallery demonstrates each. At most one callout per authored slide.
For optional claim-supporting scenes, load `compositions.css` after `deck.css`.
See [visual storytelling](visual-storytelling.md) and
[visual deck gallery](../visual.deck.html) for a readable hero fade, split,
panorama, circle/oval, and diagonal/organic crops. Keep the canonical UI tokens;
natural material or authorized logo colors remain image content.
**No reveals, tabs, detail grids, buttons, links, or media controls inside
slides.** Legacy reveal handling remains for older files, but new documents
and the validator enforce a non-interactive presentation surface.

Use the shared single-accent palette for every component and inline SVG.
**Accent** and **Dark/Light** affect the whole deck, not one slide. See
[design system](design-system.md) for defaults, persistence, and head syncing.

## Pacing and controls

`.frag` marks a point to show on the next advance. It reserves space without
being visible or exposed to assistive technology until revealed. Do not
fragment the title, an entire diagram, or a code block.

| Control | Action |
|---|---|
| Right / Space / Next / click / swipe left | Next point, then next slide |
| Left / Prev / swipe right | Previous point, then previous slide |
| PageDown / PageUp | Skip to the next / previous whole slide |
| Home / End | Opening / closing |
| Slides / O | Slide index |
| Animations / A | Step through points / show all |
| Full screen / F | Full screen |
| PDF | Save as PDF, one landscape page per slide |
| Dark/Light; Accent | Document appearance |

Animations are saved per document. Reduced motion always shows every point
and disables stepping. Native focused controls retain their keyboard
behavior. Navigation focuses the slide, and the index returns focus when
closed. The current ID remains in the URL hash and survives reload. An open
deck holds a screen wake lock so the display does not sleep or lock while
presenting; see [slides mode](slides-mode.md#keeping-the-screen-awake).

### Focusing a slide in an embedded preview

No extra runtime API is needed. Load the iframe's document with `#s-headroom`;
after the deferred runtime boots, `.deck-stage .slide[data-current]` is that
slide and receives focus. After load, assign the iframe window's
`location.hash` to another stable slide ID: the runtime's `hashchange` handler
navigates, resets the fragment step, fits the body, and focuses the slide.
If the requested hash is already current, focus the current section with
`focus({ preventScroll: true })` instead; no new hash event fires.

`[data-deck="prev"]`, `[data-deck="next"]`, and `[data-deck="index"]` are the
generated navigation controls. Index entries use `[data-go]` and their
zero-based slide index. Prefer stable hashes over index numbers. Merely
setting `data-current`, or using `history.replaceState`, bypasses navigation
and is not a supported focus operation. Same-origin iframe access is required;
a cross-origin or opaque sandbox preview needs its own host bridge.

## Fit is a guardrail, not a design tool

`.slide-body` is measured on navigation. A small corrective zoom may shrink it
no lower than **0.85**. Overflow after that emits an explicit warning and
fails validation. Headings and footnotes stay full size; they must fit too.
Prefer fit 1.0. Shorten or split a slide rather than rely on compression.

Without JavaScript, slides stack vertically and all fragments remain visible.
Print emits one landscape page per slide without controls, in the light
palette. `export-pdf.js` writes and checks that PDF; see
[PDF export](pdf-export.md). Inspect screenshots in all eight appearance
combinations even when geometry checks pass.
