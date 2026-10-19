# Deterministic 2D fallback

This backend draws an authored score. It does not invent pedagogy, create a
professional film from arbitrary text, run critics, or guarantee learning.
Use a more capable animation engine if its primitives constrain the explanation.

## Prerequisites

Python 3.10+, Pillow, FFmpeg/FFprobe with libx264/AAC, a font covering the
narration language, and Azure CLI with an existing authorized login.
No new cloud resources or SDK packages are required.

Check installed tools first. Only install a missing dependency after a
missing-dependency error or an intentional manifest change. Inspect effective
registries and use the organization's approved feed. On a managed machine,
query compatible available versions there and resolve them; do not assume an
upstream release is available or bypass quarantine. `uv` needs its own source
configuration. Do not modify unrelated environments.

## Job files

Keep the following in a private job directory:

- `score.json`: title, language, shots, sentences, explanatory primitives.
- `azure.json`: endpoint, resource_id, voice, locale, style and cache path.
  No keys or tokens. The endpoint/resource ID can still identify an account,
  so do not put this file in a public package.
- Output: MP4, captions, chapters, transcript, timing/provenance, frames and QA.
- Separate brief, evidence manifest, critic rounds and human casebook.

## Score contract

The root has `title`, `subtitle_language` (ISO 639-2, such as `ces` or `eng`)
and `shots`. Every shot has:

- Unique filesystem-safe `id`, `heading`, `chapter`, `takeaway`, `source`.
- `sentences`: spoken strings or objects with `text` and `pause_after` seconds.
  A prediction question can have a deliberate pause before the next unit.
- `heading_show`: reveal cue, default 0. A heading normally poses the puzzle
  rather than answering it. `takeaway` and `source` remain authoring/provenance
  metadata, not automatically visible text. Legacy `takeaway_show` cue types
  are validated for compatibility but do not draw a strip. Author any intended
  visible conclusion as a normal element with its own reveal.
- Optional `layout`: `standard` (default) draws chapter/heading; `title` suppresses
  that header so an authored opening can use the full canvas.
- Optional `predictions:[{"unit":1,"answer_surfaces":["takeaway"]}]` declares
  where an answer is shown. Surfaces can be `heading`, `takeaway` or an element
  ID. Invisible metadata `takeaway` and a title-layout's suppressed `heading`
  are not checked as visible answers. Prefer actual element IDs. Validation rejects declared
  answers revealed before that unit's pause ends.
  This checks declared timing, not the semantic truth of an undeclared label;
  the critic must inspect headings and all visible information.
- `inference`: intended learning step, inspected by the critic.
- `elements`: persistent IDs and drawing primitives. Supported types are
  `text`, `rect`, `circle`, `line`, and `polyline`.

Geometry uses a 1280x720 logical canvas and scales to 1920x1080 by default.
Header occupies y=0..140; the main illustration normally uses y=155..665.
There is no automatic footer, source line, shot ID, progress bar or takeaway
strip. A title layout can use the full canvas. Keep necessary assumptions in
normal explanatory labels or narration and provenance in the job materials.
Text supports `size`, `width` (wrapping), `center`.

Geometry and text use tiles drawn at twice the output scale and reduced with
Lanczos filtering; static tiles are cached instead of repeatedly filtering a
whole high-resolution frame. Arrow shafts end at the head's base, with rounded shaft caps
and polyline joins. This addresses source aliasing and square tips rather than
trying to hide them with codec settings. The last identical visual state is
cached; motion and visibility changes invalidate it. Inspect encoded samples
at native size, since antialiasing alone does not guarantee compression quality.

Geometry properties `x`, `y`, `w`, `h`, `x2`, `y2`, `r`, `stroke`, `progress`
accept either a number or a strictly time-ordered track `[[cue,value], ...]`.
`show:[start,end]` controls a visibility interval. `color`/`fill` use #RRGGBB.
`line` can have `arrow:true` and an animated `progress` to trace a relationship.
`polyline` takes `points:[[x,y], ...]`. An arrow on a polyline is rejected rather
than silently ignored; use a separate final `line` with `arrow:true`.
Arrowheads scale with stroke thickness. Use labels/shapes as well as color.

A cue of 0 is the first sentence's beginning, 1 the second sentence's beginning.
Fractions interpolate within the **measured speech**, not a guessed wall-clock
duration. The cue freezes just below the next integer during an intentional
pause; the next unit and its answer appear only when that speech begins.
No premise event should be delayed until a prediction pause. For phrase-level precision,
split at a natural speech boundary or use a backend with word alignment.

Example object:

```json
{
  "id": "sample",
  "type": "circle",
  "x": [[0, 200], [0.85, 800]],
  "y": 350,
  "r": 12,
  "color": "#79d4c2",
  "show": [0, 1]
}
```

This describes object motion, not proof that a particular model is correct.
Verify a quantitative animation independently and label invented numbers.
Sentence-level subtitles are timed to actual audio segments; they are not
word-level forced alignment.

## Commands

Use Windows path separators on Windows. For example, from the package directory:

```powershell
$env:PYTHONUTF8 = '1'
python scripts\film.py prepare --score C:\job\score.json --output C:\job\out --azure C:\job\azure.json
python scripts\film.py snapshots --score C:\job\score.json --output C:\job\out
python scripts\film.py render --score C:\job\score.json --output C:\job\out
python scripts\film.py assemble --score C:\job\score.json --output C:\job\out
python scripts\test_pipeline.py
```

The UTF-8 setting prevents legacy Windows redirected-console encodings from
rejecting Czech and other non-ASCII progress messages.

`all` combines these stages. `render --only <shot-id>` supports a representative
prototype. Speech is content-cached; a score change requires `prepare` again,
but unchanged sentences are not synthesized again. Rendering is also
content-cached. Do not share a job directory between concurrent writers.

The script embeds optional captions and chapters in `video.mp4`, writes
sentence-timed `captions.srt` separately, and uses measured two-pass loudness
normalization. It checks font bounds but not all object collisions or actual
pedagogical quality. Snapshots include authored keyframes, visibility changes,
before/at/after cues and both ends of thinking pauses. `frame-index.json` records
their actual times; use it rather than treating old files in a resumed job as
current evidence. Inspect rendered output too, not only regenerated frames.
Normalization targets -16 LUFS with an initial -3 dBTP pre-codec margin.
Assembly measures the encoded AAC and permits up to three corrective re-encodes;
it fails explicitly if the result is not within 0.5 LU of -16 LUFS and at or
below -1.5 dBTP. Attempts and measurements are recorded in `loudness.json`.
When dynamic normalization responds nonlinearly to gain, correction uses the
measured positive response of consecutive candidates with the same peak target,
bounded to 0.5-4 times the initial unit-gain step. This changes convergence,
not the acceptance limits or maximum number of attempts.
Trim normalization's trailing padding to the measured timeline before AAC
encoding; do not let filter padding extend narration beyond the video.
Independently check the delivered file rather than trusting filter targets.

Shot IDs are validated before becoming filenames; duplicate/reserved names,
invalid tracks and declared premature answers fail explicitly. Assembly
rejects missing or stale clips. It must use the same font and resolution as
rendering. Default subtitle language is unknown unless `subtitle_language`
declares it; an English job is not silently labeled Czech.
The render cache conservatively includes total film duration as well as score,
timing, audio, font, raster size and engine source. Retiming can therefore
invalidate otherwise unchanged clips; never rewrite cache stamps to bypass it.

Verify the final file with FFprobe and a full FFmpeg decode, and measure final
audio loudness/peak rather than only trusting normalization settings. Compare
actual duration to the profile and timing manifest. A successful render is not
critic approval or human acceptance.
