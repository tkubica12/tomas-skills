# Design system

## Grayscale plus one accent

Black, white, and neutral gray supply the structure. **One accent family is
active across the entire document**, including both reading and presentation:

| Accent | Light | Dark |
|---|---|---|
| Blue (default) | `#0068bd` | `#69b8ff` |
| Orange | `#a94000` | `#ffae72` |
| Green | `#137344` | `#6cd6a0` |

Do not color-code categories, combine accent families, or add red/yellow
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
orange, and green are the only valid accent choices. The runtime resolves:

1. Valid `?theme=light|dark` and `?accent=blue|orange|green` overrides.
2. The reader's choice saved for this document.
3. The authored defaults.
4. System theme and blue accent.

Give every document a stable, unique `<meta name="doc-id" content="...">`.
Appearance and animation settings use `html-docs:<doc-id>:<setting>` in local
storage. Without an ID, pathname is the fallback, with `.standalone` removed.
Independent documents do not inherit each other's choices. Local storage
access can be unavailable under browser policy; the current view still works.

**Dark/Light** switches theme. **Accent** cycles blue, orange, green, with an
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
enough clearance between labels and geometry. Test all six palettes with a
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
Article print shows the full reading reference, not the duplicate summaries.
Deck print shows every slide with all fragments. Inspect an actual PDF when
PDF is a requested output; HTML validation alone does not verify pagination.
