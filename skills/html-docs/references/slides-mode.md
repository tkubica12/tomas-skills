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
hidden in reading mode, the reading PDF, and the no-JavaScript fallback. **All
essential information must therefore also exist in the reading body.** The
slides PDF prints exactly these surfaces; see [PDF export](pdf-export.md).

Optional image-led cues can use `compositions.css`, loaded after the view
styles. See [visual storytelling](visual-storytelling.md) and the
[visual article gallery](../visual.article.html): the same hero, split, strip,
and shaped-crop classes work inside `.slide-content` and `.card-body`, without
generation/cloud dependencies or a change to the single-accent UI palette.

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
| PDF | Save the slides as a 16:9 PDF, one page per slide |
| Escape / Slides | Return to reading at the current card |

Horizontal swipes move forwards/backwards. Keyboard actions respect native
buttons and dialogs: Space on a focused button activates it, not the slide.
Navigation moves focus to the current surface, which announces its position
and title. Closing the index restores slide focus.

## Keeping the screen awake

While presenting, the runtime holds a **screen wake lock**, so the display does
not dim, blank, or start the screen saver, as presentation software does. That
also prevents the lock screen that follows a display timeout. It is released
when the reader returns to reading. The browser drops the lock whenever the tab
is hidden; the runtime requests it again when the tab returns or on the next
key or click. It works from a local file in current Chrome, Edge, Safari, and
Firefox. A browser may refuse it in battery saver or inside an embedding frame;
presenting still works, only without the lock. A managed-device policy that
enforces its own inactivity lock can still apply; test on the presenting
machine before an important talk.

## Appearance and links

Both views share **Dark/Light** and **Accent** controls. Choose one document
default with `data-default-accent="blue"` (or `red`/`green`/`yellow`) and optionally
`data-default-theme="light"` or `"dark"`. See [design system](design-system.md).

`?view=slides#card-headroom` opens that card's concise surface.
`?view=slides&theme=dark&accent=red#opening` opens a red-orange/dark title slide.
Exiting presentation removes `view=slides` and opens the current reading card.

### Focusing a slide in an embedded preview

Load the iframe with `?view=slides#card-headroom` to enter Slides and focus
that card's concise surface after the deferred runtime boots. A chapter
divider uses the chapter ID instead of a card ID. The current slide container
has `[data-slide-current]`; its surface is the direct `.slide-content` child,
or the direct `.chapter-label` child for a divider.

After load, assign the iframe window's `location.hash` to a stable slide ID.
While presenting, the runtime's `hashchange` handler selects that slide,
resets fragments, and focuses its surface. If initially in Read, set the hash
then click `[data-action="toggle-slides"]` once; the toggle resolves the hash
on entry. Do not toggle when already presenting. If the hash is already
current, explicitly focus its surface with `focus({ preventScroll: true })`.

Generated controls use `[data-slide="prev|next|index"]`; index entries use
`[data-go]` with a zero-based index. Prefer stable hashes. The document event
`html-docs:present` announces presentation entry to other views; it is **not**
a navigation command. Setting attributes directly or `history.replaceState`
does not run the navigation handler. Same-origin iframe access is required;
opaque sandbox/cross-origin frames need their host's separate bridge.

## Sharing and review

Run the single-file exporter when sharing is requested. Present and distribute
the same generated HTML; do not maintain a second deck or edit the export.
Validate source and isolated export across all eight palettes at laptop and
projector sizes, then inspect screenshots of the opening, diagram, busiest
slide, and closing. A clean console is not evidence of good composition.
