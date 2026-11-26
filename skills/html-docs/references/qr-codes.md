# Optional QR cards

Use a QR card only when the audience benefits from opening a supplied URL:
resources, a demo, or a follow-up. It is not a mandatory template element.
Prefer a deliberate closing/resources surface; do not crowd an intentional
opening or place it on every slide. Reserve space in the existing content
grid, not absolute positioning over copy. Keep a visible, exact destination
and a meaningful label even without JavaScript. Article Read may additionally
link the URL; slide and sheet captions stay noninteractive.

## Generate locally, not at runtime

Never draw an invented matrix or reuse another destination's encoded data.
The optional `assets/qr.py` uses Segno to encode the supplied HTTP(S) URL as
a regular QR symbol, with ECC H and four white modules on every edge.
It emits an HTML figure with inline SVG, not JavaScript, an image-service
request, a redirect/tracking URL, or a dependency for readers. Segno is a
small **authoring-only** Python dependency; ordinary documents need none.

Inspect effective Python feed settings and available versions before installing
`assets/qr-requirements.txt` in a suitable authoring environment. Preserve an
approved project-specific feed and follow managed-feed rules; do not replace
it with public PyPI. The pinned encoder has no required transitive dependencies.

```powershell
python -m pip config list
python -m pip index versions segno
python -m pip install -r assets\qr-requirements.txt
# Example input only: replace with the exact intended destination.
"https://example.org/resources" | python assets\qr.py --out resources-qr.html --label "Materials and code"
# Optional icon: use a different output path; existing files are never overwritten.
"https://example.org/resources" | python assets\qr.py --out resources-qr-icon.html --label "Materials and code" --icon
```

Pipe sensitive input from a private file rather than putting it in shell
history. Do not send destinations to QR web services or log them unnecessarily.
The QR, caption, generated HTML, screenshots and PDFs **disclose the URL**:
do not embed bearer tokens, credentials, private invitations or secrets in a
shared artifact. The tool rejects credential-bearing URLs; it cannot recognize
all secret query parameters. It neither visits nor verifies the destination.
For non-ASCII input, ensure the shell pipe is UTF-8 (or redirect a UTF-8 file
into Python); the bytes reaching the encoder determine the destination.

Copy the generated figure into the editable source and load
`assets/qr.css` after the view styles. This optional stylesheet draws a white
card, offset accent backing and dashed outer frame. It reuses canonical theme
tokens, without modifying them. The machine symbol intentionally retains the
canonical light paper/ink pair in dark mode; only its surroundings follow the
selected theme. The icon uses the current family's darker light shade against
white, including yellow. No gradient or softened module geometry is needed.
Bundle normally; the inline matrix and caption survive offline and no-JS use.
Do not crop the SVG, mask its margins, invert it or apply image filters.

## Decoration is subordinate to decoding

- Preserve all finder patterns and separators, timing and alignment patterns,
  format/version information and the dark module. Keep modules square, aligned
  and high contrast. Four modules of uninterrupted white quiet zone must
  survive the **final rendering**, not merely the source viewBox.
- Keep backing, border, nearby text and other decoration outside that zone.
  Leave enough additional space that the outer frame cannot be mistaken for
  the code. Rounded card corners must not clip any of the four white modules,
  even at the outer corners. The stylesheet adds white CSS padding outside
  the SVG viewport before rounding the card; retain that extra padding.
- `--icon` adds a small terminal mark over data modules only. It refuses
  symbols whose center intersects functional patterns (including some larger
  versions). Do not force it through; omit the icon. ECC H is redundancy,
  **not a guarantee** that a logo or any fixed percentage of damage is safe.
  A new URL produces a new matrix and needs new verification.
- If experimenting with SVG `<defs>/<symbol>/<use>` or gradients, use unique
  IDs and declare QR color variables on the definition/gradient ancestor as
  well as the visible instance. A gradient defined elsewhere does not inherit
  the referencing `<use>` element's custom properties. Inspect rendered
  gradient stop colors after every palette change; an unresolved variable
  can produce a plausible-looking but unreadable symbol. The supplied
  generator avoids this inheritance trap by using direct inline paths.

## Verify the pixels people receive

Use an independent decoder on browser screenshots of the **decorated figure**,
and compare the decoded string with the exact input URL. Also inspect the
rendered four-module white ring, including all corners: successful decoding
can tolerate clipping and does not prove that the quiet zone is intact. Detecting corners,
counting modules or sampling an ideal source matrix does not prove decoding.
Test at the intended slide scale and the smallest expected displayed size,
at laptop and projector viewports, all eight palettes, offline with JavaScript
disabled. Test the final standalone output too. Aim for several device pixels
per module, then verify rather than assuming a universal minimum size.

For print/PDF, decode rasterized pages of the actual exported PDF at its
intended physical size/resolution, in both requested print themes; inspect
grayscale and printer scaling if paper distribution matters. A print-media
screenshot alone does not prove PDF output. Recheck after resizing, changing
the URL, palette, logo or export route. If a case fails, remove the icon and
other matrix decoration, increase size or use an authorized shorter URL.
Keep the visible destination usable even when scanning is impossible.

`node assets\test-qr.js` exercises freshly generated plain/decorated URL
fixtures with the existing Playwright discovery, offline/no-JS Chromium and
an independent OpenCV decoder. It tests 240/320 px cards, laptop/projector
viewports, all eight palettes, both print themes and rasterized PDFs
(PyMuPDF). It also covers rejected input, escaping, output overwrite refusal
and center-pattern refusal. Segno is needed for generation; OpenCV and
PyMuPDF are optional **test-only** Python packages, resolved through the
approved feed if absent. Set `PYTHON` to an existing interpreter if necessary.
Artifacts remain in ignored `test-results\qr`.

Passing these fixtures establishes only those conditions, not every URL,
camera, projector, printer or QR reader. Try representative physical devices
and real viewing distance for a public talk; report any untested conditions.
