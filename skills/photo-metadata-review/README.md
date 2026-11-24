# Photo metadata review

Identify photographs from visual inspection, supplied context and, where useful,
visually compared public reference photographs. Review concise descriptions in
the companion Copilot canvas before writing anything to the photos.

The skill and the [photo-metadata-review canvas](https://github.com/tkubica12/tomas-skills/tree/main/extensions/photo-metadata-review)
are separate packages. The skill is portable; the canvas requires a Copilot
host with extension canvas support. Install the entire skill folder into
`~/.agents/skills/photo-metadata-review`, and install the companion extension
using the Copilot app's extension installer.

## Requirements

Python 3.11+, ExifTool with write and `ImageDataHash` support for the requested
formats, and the packages in `requirements.txt` are needed. Pillow fully
decodes JPEGs; rawpy uses LibRaw to decode supported RAW files, and tifffile
decodes TIFF image pages and supported linear DNGs. The helper does not download tools or
install packages. Follow the machine's approved package and software sources;
inspect existing configurations before installing dependencies.
A personal Windows installation may keep its Python environment in `.venv`
and ExifTool at `.tools/exiftool/bin/exiftool.exe` within the skill directory.
Those local runtime files are not included in the published skill.

Close other applications that might edit the selected files while writing.
The helper detects many concurrent changes but cannot guarantee exclusive
access against software that ignores its private review lock.

## Workflow

Put `REVIEW_DIR` in private session storage, outside the selected source
directories. It must not already exist. `PHOTO_DIR` contains the exact
JPG/JPEG files to review; `RAW_DIR`, when supplied, is searched only for
matching RAW files directly in that directory. Omit `--raw` for JPEG-only
work. Use `--files name1.jpg name2.jpg` to limit the review to named direct
children rather than every JPG/JPEG in `PHOTO_DIR`. To review independent CR2,
ARW, DNG or TIFF photographs, explicitly select them with `--files image.CR2 image.tif`
and omit `--raw`; no artificial JPEG pair is needed. The helper does not
recurse. Pass the ExifTool executable path as `EXIFTOOL`.

```powershell
python scripts\photo_review.py init --photos PHOTO_DIR --raw RAW_DIR --review REVIEW_DIR --exiftool EXIFTOOL --language cs
python scripts\photo_review.py status --state REVIEW_DIR\state.json
```

Initialization reads the files, records capture times and fingerprints, and
creates local thumbnails. It does **not** write photo metadata. It reads any
existing EXIF, XMP and IPTC captions into `existingDescription`; when exactly
one distinct, valid, non-placeholder caption exists, it prefills `description`
with `descriptionSource: "existing"` so a good caption is kept rather than
blanked. Conflicting or camera-placeholder captions (for example
`OLYMPUS DIGITAL CAMERA`) are not prefilled. The agent visually inspects each
photo and writes a private UTF-8 JSON proposal array:

```json
[
  {
    "id": "photo.jpg",
    "description": "A museum in the city.",
    "confidence": "medium",
    "visuallyExamined": true,
    "evidence": [{"label": "Public reference photo viewed and compared", "url": "https://example.org/reference"}]
  }
]
```

Valid confidence values are `high`, `medium`, `low` and `unknown`. A source
URL is optional; do not record a visual comparison unless it actually
happened. Keep proposals and evidence private. Apply proposals against the
latest state revision, then open the canvas with the following input:

```powershell
python scripts\photo_review.py apply --state REVIEW_DIR\state.json --revision REVISION --proposals PROPOSALS.json
```

```json
{"statePath": "C:\\private-session\\review\\state.json"}
```

For feedback, include `--feedback-id ID` and proposals covering every photo
in that pending feedback. The canvas refreshes from the same state and keeps
draft comments separate. The user's explicit write button freezes all displayed
descriptions, including uncertain ones. Without the canvas, show the user the
complete list and, after the user explicitly authorizes writing it in chat,
freeze the same revision with that authorization quoted:

```powershell
python scripts\photo_review.py approve --state REVIEW_DIR\state.json --revision REVISION --authorization "USER'S APPROVAL"
```

Either path yields a request ID. Use that exact ID:

```powershell
python scripts\write_descriptions.py --state REVIEW_DIR\state.json --request-id REQUEST_ID --exiftool EXIFTOOL
```

The writer reports verified and skipped counts and a private journal. It
updates the canvas state itself. Before changing each JPEG, it first performs
the same approved write and verification on a private copy. If that trial
shows unexpected metadata changes or write warnings, the JPEG and any paired
RAW are skipped without writing the source. If the sole unexpected change is
adding an absent IFD0 `YCbCrPositioning`, the helper retries on a fresh copy
with ExifTool's `NoMandatory` option. Only a fully verified retry permits the
same option on the source; the journal records `exiftoolNoMandatory`.
This adds I/O and requires private
disk space for the trial and its recovery copy. Other trial errors stop the
request. A technically ambiguous RAW is skipped; an
eligible JPEG can still be written. When ExifTool cleanly refuses a file (for
example a broken IFD0 `OtherImageStart` pointer in edited Canon JPEGs) and the
file is proven byte-identical afterwards, it is skipped with the reason and the
run continues. Any other failed or interrupted write stops and retains its
recovery copy. Do not retry the same request or restore over a possibly
concurrent edit without inspecting the journal and the files.

Phone and camera JPEGs commonly carry Multi-Picture (MPF) images such as
gain maps or previews (Xiaomi, Sony, Canon), EXIF thumbnails, and directories
written out of order. The writer accepts these only with proof: every indexed
MPF image and identifiable JPEG trailer stream is byte-identical and still
decodes, the complete trailer is byte-identical, MPF offsets move only by the
primary image's size change, RAW/TIFF strips, tiles, previews and thumbnails
keep identical byte hashes when relocated, and ExifTool's only accepted message
is its re-sort of an out-of-order EXIF directory. The journal records
`relocatedMetadata`, `exiftoolRepairs` and `repairedValidation`.
TIFF verification decodes every page and SubIFD that tifffile can access;
unsupported, undecodable or unhashable files are not reported as verified.
Sony SR2 metadata is compared in decrypted form with only validated directory
pointers normalized, while Sony hidden data is checked byte-for-byte.
PSD files and `.THM` video thumbnails are not selected or written.

See [SKILL.md](SKILL.md) and [safety.md](references/safety.md) for the full
workflow and limits.

## Validation and limits

Set `PHOTO_TEST_EXIFTOOL` to the executable path to run the integration cases;
otherwise those tests are explicitly skipped. For the optional CR2 relocation
regression, set `PHOTO_TEST_CR2` to a Canon sample with IFD2/IFD3 strips; the
test modifies only a temporary copy:

```powershell
python -m unittest discover -s tests -v
```

The tests use temporary fixtures. Actual supported RAW formats depend on the
installed ExifTool and LibRaw versions; unsupported or undecodable files are
not silently written. A successful image-data and decoded-pixel comparison
does not guarantee every application can interpret every vendor's metadata.
Independent backups remain advisable.
