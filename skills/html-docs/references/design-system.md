# Design system

The visual language is fixed. It exists so that every document from this skill
looks like it came from the same hand, and so that an author never spends
attention on colour.

## Palette

Black, white, and grey, with a single accent: Microsoft blue `#0078D4` in
light theme, lightened to `#4AA3E8` in dark theme. One warning hue. Nothing
else. No second accent, no category colours, no charts with a rainbow legend.

The canonical values live in `assets/tokens.css`. That file is the
**source of truth**; it is never linked by a page.

## Why tokens are inlined, and why that is not duplication

Each document carries its own copy of the token block in an inline `<style>` in
the head, immediately after the theme bootstrap script. Two reasons:

1. The theme must be correct on first paint. A linked stylesheet can arrive
   after the first frame, which produces a white flash before a dark page.
2. The palette travels with the content. The complete single-file export also
   inlines layout and behavior; inline tokens alone do not make a linked source
   self-contained.

`article.css` and `deck.css` therefore contain **no palette values in the
normal cascade**. They open with:

```css
@layer tokens-fallback {
  :root { /* full light palette */ }
  [data-theme="dark"] { /* full dark palette */ }
}
```

An unlayered rule always beats a layered rule regardless of source order and
specificity. So the page's inline `<style>` wins over the stylesheet's fallback
no matter which loads first. That is the whole trick; do not "simplify" it by
removing the layer.

## Rules

- **Never change a token value in a page.** If a colour is wrong, it is wrong
  for every document, so fix `assets/tokens.css` and re-copy the block
  into the templates. Then say so to the user.
- **Never introduce a new colour literal in page markup.** Not in an inline
  `style`, not in an SVG `fill`, not in a `<mark>`. Diagrams use
  `currentColor`, `var(--accent)`, `var(--border)`, `var(--text-muted)`, and
  `var(--surface-2)`.
- **No emoji.** Arrows come from CSS `content: "\2192"` on `.arrow-list li` and
  `.sequence li`. Status is expressed with a labelled callout, not a glyph.
- **No decorative imagery.** Every figure carries information.

## Token reference

| Group | Tokens | Use |
|---|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-2`, `--surface-3` | Page, card, quiet block, quietest block |
| Lines | `--border`, `--border-strong` | Hairlines, and lines that need to read as structure |
| Text | `--text`, `--text-muted`, `--text-faint` | Body, secondary, metadata |
| Accent | `--accent`, `--accent-strong`, `--accent-quiet`, `--accent-soft`, `--accent-border` | Links, labels, the verdict callout, focus |
| Warning | `--warn`, `--warn-soft`, `--warn-border` | The warning callout only |
| Code | `--code-bg`, `--code-border` | Code blocks and inline code |
| Shape | `--radius`, `--radius-sm`, `--canvas` | Corners, and the article reading width |
| Type | `--font-sans`, `--font-mono` | System stacks; no web fonts, ever |
| Depth | `--shadow-1`, `--shadow-2` | Rest and raised |

`--canvas` is `1160px`: the article measure. Do not widen it to fit a table;
make the table narrower or put it behind a reveal.

## Typography

System font stacks only. No `@font-face`, no Google Fonts, no icon font. The
document must render identically offline and on a locked-down corporate
machine.

Weights in use: 400 body, 500–560 for labels and card titles, 620–700 for
headings. Do not add italics for emphasis; restructure the sentence instead.

## Theming

The theme bootstrap in the head runs before first paint and resolves, in order:

1. `?theme=light` or `?theme=dark` in the URL — for sharing a specific
   rendering, and for screenshots.
2. `localStorage["doc-theme"]` — the reader's last choice, shared across every
   document produced by this skill.
3. `prefers-color-scheme`.

It also adds `class="js"` to `<html>` synchronously. Every rule that hides
content is scoped under `.js`, which is what makes the no-JavaScript rendering
complete rather than collapsed. Do not move the bootstrap below the token block
and do not defer it.

## Diagrams

An SVG referenced from `<img src="...">` is a separate document. It cannot read
`currentColor`, it cannot read the page's custom properties, and it will not
inherit the page's `data-theme` attribute. A diagram authored against the light
palette therefore appears as a bright plate on a dark page.

The fix is to give the SVG its own internal stylesheet keyed on
`prefers-color-scheme`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 420" role="img" aria-label="...">
  <style>
    .bg  { fill: #ffffff; }
    .box { fill: #ffffff; stroke: #c2c7cf; }
    .t   { fill: #14171a; }
    @media (prefers-color-scheme: dark) {
      .bg  { fill: #0e1013; }
      .box { fill: #1b1f26; stroke: #3d4550; }
      .t   { fill: #eceef1; }
    }
    text { font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif; }
  </style>
  <rect class="bg" width="1600" height="420"/>
  ...
</svg>
```

This tracks the page's own toggle, not just the operating system, because the
browser propagates the embedding element's used `color-scheme` into the embedded
document — and the token block sets `color-scheme` on both `[data-theme="light"]`
and `[data-theme="dark"]`. Test with the browser emulating dark while the page
is set to light: the diagram should stay light. No JavaScript is involved,
and the file still opens correctly on its own.

For a small diagram directly embedded as inline `<svg>`, use the page's
`var(--text)`, `var(--accent)`, and surface/border tokens directly. Include a
`viewBox`, an accessible title and description, and responsive dimensions.
Inline SVG inherits the page theme and needs no separate file or lightbox.

Give every element a class and swap only colours in the dark block. Do not
duplicate geometry per theme.

Two practicalities when writing SVG by hand:

- **Trim the `viewBox` to the drawing.** The browser fits the image by whichever
  axis binds first, so blank space inside the `viewBox` shrinks the whole
  diagram inside its frame. If you move the `viewBox` origin, move the
  background `rect`'s `x`/`y` to match, and update the `img` `width`/`height`.
- **Leave clearance around hand-placed labels.** You cannot measure text, so a
  `text-anchor="middle"` label beside a box will silently overlap it. Budget
  roughly 60% of the font size per character, and keep about 20px of clear space
  on each side. Check the rendered result; do not trust the coordinates.

`assets/sample-diagram.svg` is a minimal working example of all of the above.

## Motion

Transitions are short and confined to opacity and transform. Everything is
wrapped so that `prefers-reduced-motion: reduce` disables it. Nothing moves
without a user action; there is no autoplay, no scroll-triggered animation, and
no entrance effect.

## Print

Both runtimes carry a print block. The article prints as a flat document with
every reveal expanded and all chrome removed. The deck prints one landscape
page per slide. Check print output with `page.pdf()` when the user says the
document will be shared as a PDF.
