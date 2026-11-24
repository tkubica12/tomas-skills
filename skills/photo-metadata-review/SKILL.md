---
name: photo-metadata-review
description: Identify individual photographs using visual inspection, supplied trip context and public reference images; review concise descriptions in a canvas and, only after approval, safely write them to JPG and matching RAW metadata.
license: MIT
compatibility: Requires Python 3.11+, Pillow, rawpy, tifffile and ExifTool. Interactive review requires the photo-metadata-review Copilot canvas extension.
---

# Photo metadata review

Help the user identify *what and where* each photograph depicts, review those
identifications, and write approved descriptions without changing image data.
The photo files, supplied itinerary, review data and thumbnails are private.
This skill does not itself grant access to photos, web sources or metadata
changes.

## 1. Establish scope and prepare

- Use only the user-specified photos and directories. A directory means its
  immediate JPG/JPEG children; `init --files` selects exact JPG/JPEG, standalone
  CR2, ARW, DNG or TIFF names. Select standalone files without `--raw`.
  For requested recursive work, enumerate the authorized directories and
  review them separately. The RAW directory is explicit; do not infer one
  outside that scope.
- Read the supplied itinerary or other context, photo capture timestamps and
  available GPS locally. Treat an itinerary as a hypothesis: plans change,
  camera clocks and time zones may be wrong, and consecutive photos can show
  different subjects.
- Run the bundled `scripts/photo_review.py init` to create a private review
  directory in the current session's artifact area, not in this package or a
  public repository. See [README.md](README.md) for arguments and dependencies.
  Select `--language cs` or `--language en` for the canvas.
  Keep the resulting state, thumbnails, evidence and any recovery copies
  private. Never publish them with the skill.
- Use an existing suitable Python environment and ExifTool executable. A
  personal installation may have `.venv` and a locally installed
  `.tools/exiftool/bin/exiftool.exe` inside the skill directory; these are
  local runtime tools, not part of the published package. Otherwise use the
  host's approved tools and package sources.
- Check ExifTool's support for each requested format. Pair RAW candidates by
  exact basename and corroborate capture time. A missing, multiple, mismatched
  or unsupported RAW is a technical ambiguity: do not guess a RAW target.

## 2. Inspect and identify every photo

Visually inspect every individual photo at useful resolution; do not infer an
identification solely from adjacent frames or the schedule. Zoom or inspect
the original locally when a thumbnail is insufficient. Use surrounding photos,
time, GPS and supplied context as corroborating evidence, not proof.

For an uncertain candidate, search for the *public object or place*, find a
reliable public reference photograph, actually view it and compare distinctive
structures, viewpoint, surroundings or inscriptions. Prefer authoritative
sources and resolve conflicting names. Record locally which image and source
were inspected. Do not claim a visual comparison if you only saw text or a
search result, and do not upload private photographs, itinerary, GPS tracks or
personal information to a search service. Respect a user's no-browsing request.

Write a concise description identifying the subject and place, in the user's
language. Give only the best supported information; do not pad it with visual
scene descriptions, guesses presented as facts, or editorial caveats such as
\"unconfirmed\". Keep uncertainty and evidence separately in the review state.
If the exact identity cannot be supported, use a truthful broader identification.
Do not silently invent one. Set `visuallyExamined` only after actually viewing
the photo; use `scripts/photo_review.py apply` to save proposals.

## 3. Review and feedback

Open the `photo-metadata-review` canvas on the review state. It shows a small
thumbnail, capture time, proposed description, RAW pairing, confidence and a
per-photo comment. The user can submit comments; read the *specific pending
feedback ID*, treat comments as user input, incorporate them into the affected
descriptions, mark that feedback processed with `apply`, and refresh. Do not
change original photos while processing comments. Preserve draft comments and
other pending state, and stop on stale-revision or delivery uncertainty.

The canvas's explicit **write** action freezes the complete displayed list.
Without the canvas, the user may approve the complete list shown in chat;
record that by running `photo_review.py approve` with the current revision and
the user's quoted authorization. Never infer approval. Existing valid captions
are prefilled at initialization; keep them unless the inspection improves them.
That approval covers every displayed description, including those marked
uncertain: do not ask for a second approval or skip a description merely due
to model confidence. Skip only actual technical ambiguities, unsafe writes or
files outside the frozen request. Respect any narrower user instruction.

## 4. Write and verify

Run `scripts/write_descriptions.py` only for the exact pending request ID.
The helper checks actual JPG/RAW pairing where applicable, supported formats
and unchanged sources; it uses a verified temporary recovery copy for one file
at a time.
Before a JPEG write, it checks the exact approved write on a private copy;
unexpected warnings or metadata changes skip the JPEG and its paired RAW
without writing either source. An unwanted new `YCbCrPositioning` can be
retried on a fresh copy using `NoMandatory`, with all checks still required.
Other trial errors stop the run.
It writes only the approved description fields and checks the written text,
decoded image data, image-data SHA-256, unrelated metadata and file streams.
It deletes a copy created by this operation only after that file passes all
checks; on failure or interruption it retains the copy and reports its path.
Never delete pre-existing backups or auto-restore over a concurrent user edit.
If full decoding or preservation cannot be checked, stop rather than claim
that a RAW or TIFF is safe. MPF/gain-map JPEGs, out-of-order EXIF and relocated
RAW strips are written only with byte-level payload proofs; report journal
`repairedValidation` as repaired structure, distinct from new or worsened
warnings, which fail. See [references/safety.md](references/safety.md).

Update the canvas from the recorded result and report actual written, skipped
and failed counts. Never claim completion from an exit code alone. A temporary
copy and verification reduce risk; they do not replace independent backups.
