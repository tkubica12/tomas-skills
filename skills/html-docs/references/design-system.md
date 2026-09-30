# Design system

## Grayscale plus one accent

Black, white, and neutral gray supply the structure. **One accent family is
active across the entire document**, including both reading and presentation:

| Accent | Light | Dark |
|---|---|---|
| Blue (default) | `#006da0` | `#00a4ef` |
| Red (red-orange) | `#bc3a16` | `#f25022` |
| Green | `#4c7100` | `#7fba00` |
| Yellow | `#805b00` | `#ffb900` |

Dark shades are the exact four Microsoft logo colors. Light shades are this
skill's darker counterparts, not officially documented Microsoft logo
variants. Yellow becomes gold/ochre on light backgrounds. The runtime keeps
the selected family while switching its shade with the theme.

Do not color-code categories, combine accent families, or add separate
warning colors. A warning uses the selected accent; its explicit **Warning**
label, not color alone, conveys its meaning. Charts distinguish series with
labels, patterns, line styles, or grayscale.

The only source of palette values is `assets/tokens.css`. Layout stylesheets
have no fallback palette. Never override tokens or invent colors in a page.

## Canonical head and first paint

Copy the template's head, including these marked inline blocks:

```html
<script data-doc-bootstrap>...</script>
<style data-doc-tokens>...</style>
```

The first block is `assets/appearance.js`, executed synchronously before
styles. It resolves appearance and adds `.js` before anything is painted.
The second is `assets/tokens.css`, copied verbatim. Neither depends on an
extra request before first paint. Linked runtime assets follow them.

Use the built-in synchronizer after a shared head asset changes:

```powershell
node assets\sync-head.js my-document.html
node assets\sync-head.js --check my-document.html
```

Pass multiple source files to synchronize or check a whole collection. Missing
markers fail explicitly. Do not synchronize generated standalone exports;
regenerate them from their sources instead.

## Defaults and reader preferences

```html
<html lang="en" data-default-accent="blue" data-default-theme="light">
```

Omit `data-default-theme` to follow the operating system initially. Blue,
red, green, and yellow are the canonical accent choices. The runtime resolves:

1. Valid `?theme=light|dark` and `?accent=blue|red|green|yellow` overrides.
2. The reader's choice saved for this document.
3. The authored defaults.
4. System theme and blue accent.

Give every document a stable, unique `<meta name="doc-id" content="...">`.
Appearance and animation settings use `html-docs:<doc-id>:<setting>` in local
storage. Without an ID, pathname is the fallback, with `.standalone` removed.
Independent documents do not inherit each other's choices. Local storage
access can be unavailable under browser policy; the current view still works.

Legacy `orange` values in URL overrides, saved preferences, and defaults
resolve to `red`. CSS accepts the old default without JavaScript too.
Use `red` for new documents.

**Dark/Light** switches theme and the selected family's shade. **Accent**
cycles blue, red, green, yellow, with an
accessible label naming the current and next choice. Changes update any
matching query override so reload does not undo the selection. All components
use the same resolved tokens. Nothing is sent to a server.

Without JavaScript, authored defaults still work through CSS; presentation
summaries stay hidden and detailed reference content remains readable.

## Semantic tokens

| Purpose | Tokens |
|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-2`, `--surface-3` |
| Text | `--text`, `--text-muted`, `--text-faint` |
| Structure | `--border`, `--border-strong` |
| Accent | `--accent`, `--accent-strong`, `--accent-quiet`, `--accent-soft`, `--accent-border` |
| Warning aliases | `--warn`, `--warn-soft`, `--warn-border` |
| Focus | `--focus` |
| Code | `--code-bg`, `--code-border` |
| Type | `--font-sans`, `--font-mono` |
| Shape | `--radius`, `--radius-sm`, `--canvas` |
| Depth | `--shadow-1`, `--shadow-2` |

System fonts only: no font downloads, icon fonts, emoji, or decorative imagery.
The reading canvas is 1160px. Do not widen it to rescue a dense table.
Accent `<em>` in slide titles is a deliberate semantic emphasis; the shared
CSS renders it upright.

## Diagrams that actually follow the controls

Prefer **inline SVG** for document diagrams. It inherits the resolved theme
and accent in the source and standalone export:

```html
<svg viewBox="0 0 640 180" role="img" aria-labelledby="flow-title flow-desc">
  <title id="flow-title">A bounded buffer before a worker</title>
  <desc id="flow-desc">Arrivals wait until the worker can complete them.</desc>
  <rect x="20" y="30" width="220" height="100" rx="12"
        fill="var(--surface)" stroke="var(--accent)"/>
  <text x="130" y="88" text-anchor="middle" fill="var(--text)">Buffer</text>
  <path d="M260 80H380" stroke="var(--accent)" stroke-width="3"/>
  <rect x="400" y="30" width="220" height="100" rx="12"
        fill="var(--surface-2)" stroke="var(--border-strong)"/>
  <text x="510" y="88" text-anchor="middle" fill="var(--text)">Worker</text>
</svg>
```

Use unique title/description/marker IDs, a tight viewBox, legible labels, and
enough clearance between labels and geometry. Test all eight palettes with a
browser system theme deliberately opposite the document's theme.

An SVG loaded through `<img>` is a separate document: it **cannot inherit
the runtime accent**. Keep such images neutral, as in
`assets/sample-diagram.svg`. Its embedded `prefers-color-scheme` follows the
embedding page's `color-scheme`. Use inline SVG when color carries emphasis;
do not hard-code blue into an external diagram. Match image width/height
attributes to the SVG's aspect ratio.

## Motion and print

Only short, user-driven point reveals animate. Reduced motion removes the
transition and shows all points. No autoplay, looping motion, or scroll effects.

Dark tokens are wrapped in `@media screen`: **every printout and PDF uses the
light palette** with the selected accent, whatever the screen theme. Print
the view that is on screen: the reading PDF shows the full reference without
duplicate summaries, the slides PDF one page per slide with all fragments, and
the sheet PDF one page per `.sheet-page`. See [PDF export](pdf-export.md).
Inspect the actual PDF when PDF is a requested output; HTML validation alone
does not verify composition.
