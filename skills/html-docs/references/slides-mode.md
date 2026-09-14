# One narrative, two depths

Article slides are **authored speaker cues**, not the reading card enlarged.
The same HTML contains both. The runtime visits the opening, each chapter
divider and its cards in document order, then the closing takeaway. Stable card
IDs link the talk directly to its fuller explanation.

## Required surfaces

Start from `article.template.html`. Keep `article.css/js` for reading and
`slides.css/js` for presentation. Put one direct `.slide-content` child inside
the header, each card, and the closing takeaway:

```html
<article class="card" id="card-headroom">
  <div class="slide-content">
    <h2 class="slide-title">Only spare capacity<br>drains the backlog.</h2>
    <ul class="slide-points">
      <li class="frag">New work keeps arriving.</li>
      <li class="frag">Recovery needs room beyond it.</li>
    </ul>
  </div>
  <h3 class="card-head">
    <!-- Use the complete card-toggle markup from the template. -->
  </h3>
  <div class="card-body">
    <p>Explain the relationship, its assumptions, and the consequences here.</p>
  </div>
</article>
```

The header's surface uses `slide-content slide-content--title`; the closing
uses `slide-content slide-content--end`. Add an optional `.slide-eyebrow` and
one `.slide-lead` line. Use `<em>` inside a title to emphasize a few words in
the current accent, not italics. Titles and closing messages deserve generous
whitespace, not a miniature agenda or a wall of takeaways.

Only these authored surfaces are displayed during presentation. Card toggles,
prose, reveals, tabs, and other reading controls are hidden. The summaries are
hidden in reading mode, print, and the no-JavaScript fallback. **All essential
information must therefore also exist in the reading body.**

## Authoring budget

- One claim per slide; at most **45 words**, including diagram labels.
- At most **three points, ten words each**; no paragraph over 18 words.
- One diagram, short equation, or other substantial visual at most.
- No reveal, tab, detail grid, link, button, media control, or other interaction
  inside a slide surface. The only interactions are presentation chrome.
- No automatic text shrinking. Shorten cues or split the idea if it clips.
- Do not add unique facts only to the summary or lose necessary qualifications
  when shortening a claim.

These are upper bounds, not targets. Most good slides use far less. Read the
rendered slide as if sitting at the back of a meeting room.

## Pacing without traps

Mark a short point `.frag` to show it on the next advance. Hidden points retain
their layout space but are removed from the accessibility tree until shown.
The title remains visible throughout; nothing moves automatically.

**Animations** or `A` switches between stepped points and complete slides.
The choice is stored per document. `prefers-reduced-motion: reduce` always
shows every point, removes transitions, and disables the stepping control.
Changing that preference while presenting takes effect immediately.

Page navigation always bypasses remaining points, so a long build cannot trap
the presenter. Going backwards by whole slide displays all its points.

| Control | Action |
|---|---|
| Right / Space / Next / background click | Next point, then next slide |
| Left / Prev | Previous point, then previous slide |
| PageDown / PageUp | Next / previous whole slide |
| Home / End | Opening / closing |
| Index / O | Named slide-index dialog |
| Animations / A | Stepped points / all points |
| F | Full screen |
| Escape / Slides | Return to reading at the current card |

Horizontal swipes move forwards/backwards. Keyboard actions respect native
buttons and dialogs: Space on a focused button activates it, not the slide.
Navigation moves focus to the current surface, which announces its position
and title. Closing the index restores slide focus.

## Appearance and links

Both views share **Dark/Light** and **Accent** controls. Choose one document
default with `data-default-accent="blue"` (or `orange`/`green`) and optionally
`data-default-theme="light"` or `"dark"`. See [design system](design-system.md).

`?view=slides#card-headroom` opens that card's concise surface.
`?view=slides&theme=dark&accent=orange#opening` opens an orange/dark title slide.
Exiting presentation removes `view=slides` and opens the current reading card.

## Sharing and review

Run the single-file exporter when sharing is requested. Present and distribute
the same generated HTML; do not maintain a second deck or edit the export.
Validate source and isolated export across all six palettes at laptop and
projector sizes, then inspect screenshots of the opening, diagram, busiest
slide, and closing. A clean console is not evidence of good composition.
