# Slides mode

An article can be presented without becoming a deck. Slides mode is a **view
over the same DOM**: there is no second markup tree, no export step, and no
copy to keep in sync. What is on the page is what is on the screen.

Use it when the written article is the artefact and the talk is a walkthrough
of it. When the talk has a different narrative from the document, build a
standalone deck instead — see [`deck-authoring.md`](deck-authoring.md).

## Enabling it

Slides mode exists if the controls bar contains the toggle:

```html
<button type="button" class="ctrl" data-action="toggle-slides" aria-pressed="false">Slides</button>
```

Remove that button and the whole slides runtime stays dormant. Do that for
articles that will never be presented; it removes a control the reader does not
need.

## What becomes a slide

The runtime walks `main` and builds the slide list as:

1. Each `.chapter` that has a `.chapter-label` — rendered as a section divider.
2. Each `.card` that is a direct child of that chapter, in document order.
3. The closing `.takeaway`, if present.

If there are no chapters it falls back to every `.card` in `main`. Anything
that is not a chapter, a card, or the takeaway is not a slide, so loose prose
between cards will not be presented. Put everything inside a card.

## Entering and leaving

- The **Slides** button toggles the view: it is how you enter, and while
  presenting it is how you get back to the article.
- `?view=slides` in the URL opens straight into presentation, which is what you
  send to someone who will present it, and what a screenshot script uses.
- `Escape` also returns to the article.
- The current slide id is written to the URL hash, so a specific slide is
  linkable and reload-safe.

Keys while presenting: `Right` / `PageDown` / `Space` forward, `Left` /
`PageUp` back, `Home` / `End` to the ends, `O` for the slide index, `F` for
full screen, `Escape` to exit. Click anywhere that is not a control advances;
horizontal swipe works on touch.

## Navigation chrome

While presenting, a small bar sits in the bottom-left corner: **Prev**,
**Next**, **Index**. The **Slides** toggle stays in the top-right corner and is
the way back to the article, so there is no separate exit button — one control
owns entering and leaving.

Both corners rest at the same low opacity so neither competes with the slide,
and both go fully opaque on hover or keyboard focus. The pressed styling on the
**Slides** toggle is suppressed while presenting: an accent pill in the corner
of every slide pulls the eye, and it reappears once the bar is hovered, which
is the moment it means something.

Two things make the chrome findable anyway. It is **held up for about four
seconds when slides mode opens**, so the reader sees where it is before it
settles, and any mouse movement lifts it again for a couple of seconds. That is
the discoverability compromise: a presenter who does not know the controls are
there is shown them once, and a presenter who does know is never distracted.

**Index** opens a jump-to-slide dialog listing every slide with its number,
title, and kind (`Chapter`, `Closing`). The current slide is highlighted.
Clicking an entry jumps straight there. This is the control you use when
someone asks a question about something four slides back.

The index labels itself from the markup: a card contributes its `.card-title`,
a chapter divider its own heading. Nothing needs authoring for the index to
work — but a card with a vague title produces a vague index entry, which is one
more reason to write real titles.

## What the reader loses, and what you must therefore do

In slides mode the current card is fixed to the viewport and every other slide
is hidden. Consequences you have to author around:

- **Collapsed content is opened.** A card presented as a slide shows its body.
  Reveals stay collapsed, so anything behind a reveal is *not* presented. If a
  point matters to the talk, it belongs above the reveal.
- **The expand-all and collapse-all controls disappear**, along with the table
  of contents, the header, the footer, and the read-progress marks. They are
  article furniture. Read tracking is also suspended while presenting, so
  running through the deck never marks the article as read.
- **Card numbers are frozen before the view switches.** CSS counters restart
  when earlier siblings are `display: none`, so the runtime writes the resolved
  number into `.card-num` on load. This is why you must never type a number
  into the markup: a typed number and a frozen number will disagree the moment
  a card is inserted.

## Fitting

Each slide is measured after it is shown. If the content is taller than the
viewport the runtime shrinks the card's children with CSS `zoom`, starting from
`available / needed` and then stepping down until the card genuinely fits,
clamped at `0.5`.

The first guess is deliberately not trusted. Margins between children and
sub-pixel rounding survive the zoom, so a single computed ratio can be several
percent too generous and leave content clipped with no warning. Converging
against the real `scrollHeight` is what makes the fit honest.

When the clamp is reached and the card still does not fit, the runtime writes to
the console:

```
html-docs: slide content does not fit at readable size. Split this card: #card-...
```

**Treat that warning as a defect, not as a note.** A card shrunk below about
70% is unreadable from the back of a room. The fix is always structural: split
the card, move detail behind a reveal, or cut it. Do not respond by changing
font sizes in the page.

### Budget a card for the slide, not for the page

A card that reads comfortably in the article can still be a bad slide, because
in slides mode it has to fit a single screen with no scrolling.

- **A full-width figure gets its own card.** A 16:9 diagram consumes almost the
  whole slide by itself. Prose *plus* a figure in one card forces the fit down
  far enough to hurt, even when it does not trip the clamp. Put the argument in
  one card and the picture in the next; the reading experience is unharmed and
  the slide becomes legible.
- The same applies to a long table or a tall code block sharing a card with
  several paragraphs.

Validation catches the failure case: see [`validation.md`](validation.md), which
asserts zero console warnings *and* zero clipped cards while stepping through
every slide. It cannot tell you that a card that merely shrank to 0.72 would
have read better as two cards. Look at it.

## Presenting checklist

Before handing an article over to be presented:

1. Open with `?view=slides` and step through every slide with `End` and the
   arrow keys.
2. Confirm the console is silent — no overflow warnings.
3. Confirm no slide depends on content that is behind a reveal.
4. Check a section divider, the longest card, and the takeaway in both themes.
5. Check at 1920x1080 as well as at the laptop size, since the room projector
   is usually the former.
