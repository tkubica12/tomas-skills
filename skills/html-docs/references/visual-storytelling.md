# Optional visual storytelling

An image is useful when it supports the slide's claim: establishes a setting,
shows a material or object, clarifies a relationship, or makes a consequence
concrete. It is not a substitute for evidence. Omit it when a diagram, words,
or empty space explains the idea better. Keep one substantial visual per slide
and the existing 45-word article / 65-word deck budgets.

**Nothing here is required for ordinary articles, decks, or sheets.** Their
authoring, reading, presentation, bundling, and printing have no Azure, cloud,
login, image-generation, or chat dependency. Use supplied local images or
original SVGs; generated images are an optional source, not a runtime.

## Brief the image before choosing a crop

Record these decisions alongside the claim (a short brief, not a mandatory
interview):

| Field | Decision |
|---|---|
| Claim and role | What the audience should understand; how the scene helps |
| Scene | Subject, action, setting, viewpoint, scale, light, and mood |
| Text-safe space | Which side is deliberately quiet; how much room the HTML copy needs |
| Crop-safe subjects | Keep faces, hands, tools, object silhouettes, and necessary labels away from cut edges |
| Materials | Specific surfaces and plausible textures; coherent timber, clay, glass, metal, fabric, etc. |
| Reference assets | Only authorized, explicitly supplied references; their provenance and permitted use |
| Invariants | Identity, geometry, orientation, proportions, approved marks, and other details that must not change |
| Delivery | Local file, aspect ratio, useful resolution, alt text, caption, and fictional/generated disclosure |

Do not bake the slide's title into the image. Keep essential text and diagram
labels in HTML or an accessible inline SVG, not inaccessible pixels. Never
present a generated scene as a measured result, real photograph, endorsement,
or evidence of an event.

For example: **claim:** “Reserve space for the claim”; **scene:** a fictional
courtyard workshop with one terracotta vessel on a timber bench at the right;
**text-safe:** quiet left half; **crop-safe:** complete vessel rim and base;
**materials:** matte clay, timber grain, pale stone; **references:** none;
**invariants:** one vessel, no lettering or logos, consistent silhouette;
**delivery:** local 16:9 artwork with a fictional caption. The galleries use
the original `assets/sample-scene.svg`, not a service or copied brand asset.

## UI colors are not image colors

Preserve `tokens.css`, canonical inline heads, the four default accent families,
and **one UI accent at a time**. Text, controls, callouts, chart emphasis,
diagram semantics, borders, and overlay surfaces use those tokens. Do not
extract a new interface palette from an image.

Natural scene colors (clay, foliage, skin, sky, materials) and the authentic
colors of an authorized supplied logo are **image content**, not additional
UI accents. Do not recolor them when the accent cycles, or apply this exception
to semantic charts/diagrams. Inline diagrams still follow the canonical theme
and accent. A photograph or scene SVG loaded through `<img>` deliberately does
not inherit them.

### Brand profiles are explicit opt-in

The default is unbranded. Use a brand profile only when the user explicitly
requests it and supplies/authorizes the relevant references. A profile can
specify approved imagery, material treatment, logo clear space, and immutable
marks; it cannot silently replace canonical UI tokens or inject a private
author, workplace, storage path, resource name, or asset. Do not infer a brand
from earlier work. If no authorized logo is supplied, omit it rather than
inventing one. Logos stay intact, preferably outside destructive crops.

## Load the small composition library only when needed

Add this **after** the selected view stylesheets:

```html
<link rel="stylesheet" href="assets/compositions.css">
```

No JavaScript, framework, cloud configuration, or new package is needed.
`bundle.js` already embeds this local stylesheet and its local `<img>` assets.
Use ordinary `src` (not remote hotlinks or an unhandled `srcset`); width/height
describe the source aspect ratio, even when CSS crops it. The source stays
linked for editing; the standalone export includes the image as a data URI.

| Composition | Markup | Use |
|---|---|---|
| Readable hero fade | `.composition.composition--hero` | A quiet left copy area and right-hand subject |
| Image/text split | `.composition.composition--split` | Separate image from the claim |
| Panorama strip | `.composition.composition--panorama` | Establish context with little vertical space |
| Circle | `.composition-media.composition-media--circle` inside a split | Isolate one subject |
| Oval | `.composition-media.composition-media--oval` inside a split | Keep more context around a subject |
| Diagonal | `.composition-media.composition-media--diagonal` inside a split | Direction with generous crop margins |
| Rounded organic | `.composition-media.composition-media--organic` inside a split | A restrained material-related contour |

### Hero: left copy, right subject

```html
<div class="composition composition--hero">
  <div class="composition-media">
    <img src="assets/sample-scene.svg"
         alt="A clay vessel rests on the right of an open courtyard wall."
         width="1600" height="900">
  </div>
  <div class="composition-copy">
    <h2 class="slide-title">Reserve space for the claim</h2>
    <p>The fade protects text.</p>
  </div>
</div>
```

The left half is an **opaque canonical surface**, not a contrast guess over
arbitrary pixels. The transition fades into the image on the right; copy
remains inside the opaque half. Use short copy; put reading prose below the
hero. Dark/light themes change the surface and text together. Do not extend
the copy into the fade or position a critical subject behind it.

### Split, including a shaped crop

```html
<div class="composition composition--split">
  <div class="composition-media composition-media--circle"
       style="--image-position: 100% 50%">
    <img src="assets/sample-scene.svg"
         alt="The crop centers the complete vessel and workbench."
         width="1600" height="900">
  </div>
  <div class="composition-copy">
    <p>Preserve the rim and base.</p>
  </div>
</div>
```

Remove the shape modifier for a rectangular split; replace it with `--oval`,
`--diagonal`, or `--organic` for the other crops. `--image-position` is the
CSS `object-position` value, not a new palette or a pixel-coordinate focal
point. Inspect the resulting subject at each aspect ratio; `cover` cuts edges.
To put copy first, move `.composition-copy` before `.composition-media` in
the DOM. Reading order must match visual order; do not reverse it with CSS.

### Panorama

```html
<figure class="composition composition--panorama">
  <div class="composition-media" style="--image-position: 50% 65%">
    <img src="assets/sample-scene.svg"
         alt="The wide courtyard strip retains the vessel and work surface."
         width="1600" height="900">
  </div>
  <figcaption class="composition-caption">Original fictional artwork.</figcaption>
</figure>
```

## View contracts, galleries, and print

- **Deck:** place a composition inside `.slide-body`. A hero can carry the
  single claim title itself; do not add a second headline.
- **Article Slides:** put it inside the card's `.slide-content`, alongside
  or containing the single `.slide-title`. No links or media controls.
- **Read:** use the same classes inside `.card-body`, with an appropriate
  reading heading (`h4` in these galleries), full explanation, and provenance.
  The presentation summary remains intentionally hidden while reading;
  essential reasoning must still live in the reading body.
- **Narrow reading:** split compositions stack in DOM order. Hero copy stays
  within its protected half. Shorten hero text instead of shrinking fonts.
- **Print:** no animations or filters; hero surfaces use light tokens, crops
  and text remain visible. Reading figures avoid internal page breaks;
  presentation keeps one page per slide. Print with backgrounds enabled
  (the PDF exporter does), and check the actual pages. With backgrounds
  disabled, light text still reads over a white paper surface.
- **Sheets:** not a new sheet layout or density allowance. Prefer the existing
  sheet components; if an image is essential, use one small local figure and
  revalidate paper fit. Do not copy an entire hero into a fixed paper budget.

Open [article gallery](../visual.article.html) in Read and Slides, and
[deck gallery](../visual.deck.html). Each demonstrates all seven compositions.
They are editable offline examples, with one original fictional asset and no
external resources. The standard component galleries link to them.

## Optional Image generator companion

If a separately installed **Image generator** (`image-generator`) canvas is available and the user
wants generated or edited artwork, the agent can hand off the brief above.
Inspect that companion's actual capabilities before invoking it; do not
assume tool names, install it automatically, or make a chat interview mandatory.
The user may approve a direct brief, supply an existing local asset, or skip
generation entirely.

Any provider login/cloud prerequisites belong only to that optional companion.
Accept its output only after checking the invariant/reference requirements,
save the approved image locally, then use the same composition markup. Do not
include credentials, service calls, remote URLs, or generation APIs in the
HTML/runtime. Changing an image requires rebuilding the standalone export.

## Check before handoff

Run the existing validator on source and isolated standalone exports. Test
all eight palettes at laptop/projector sizes, narrow Read, no JavaScript,
offline load, keyboard navigation, and light print/PDF page counts. Inspect
the hero copy's contrast, cropped subject silhouette, and meaningful alt text;
an overflow test cannot decide whether the scene supports the claim.

For the library's focused browser regression checks:

```powershell
node assets\test-compositions.js
```

See [validation](validation.md) for the full checks and browser overrides.
