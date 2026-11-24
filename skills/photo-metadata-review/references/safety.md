# Metadata writing and recovery

ExifTool commonly rewrites a file to change metadata. An interrupted write,
storage fault, invalid metadata or a format-specific incompatibility can still
make it unreadable even when the intent is only to change a description.
ExifTool recommends preserving the original and verifying the result; its
`-overwrite_original_in_place` copies temporary output back into the original
file to preserve filesystem attributes, so an interruption can affect that
original. See [ExifTool's writing guide](https://exiftool.org/writing.html)
and [application documentation](https://exiftool.org/exiftool_pod.html).

The bundled writer keeps one temporary, byte-verified recovery copy at a time
in the private review directory, outside the source photo directory. It
deletes only its own copy after checking the new description, ExifTool image
data hash, a full JPEG or supported RAW decode, unrelated metadata and
filesystem streams. A failure or interrupted operation retains that copy and
its journal; do not automatically restore it over a file that another program
or the user might have changed. The user may opt for separate long-term
backups; never remove existing backups.

Before a JPEG write, the writer also tries the exact approved description on a
verified private copy, using the same preservation checks. Unexpected write
warnings or metadata changes skip the JPEG and its paired RAW before either
source is written; other trial errors stop the request. One exception is an
added, previously absent IFD0 `YCbCrPositioning`: a fresh copy is retried
with `NoMandatory`, and the option is used on the source only if all checks
pass. The journal records this option. Trial copies are
temporary, require extra disk space and I/O, and are not an independent backup.
A successful trial cannot guarantee that a later source write will succeed:
the normal recovery and post-write checks still apply.

The `state.json.lock` directory coordinates this canvas and its Python helpers;
it does not lock other photo software. A crash may leave it in place. First
verify that no writer or canvas operation is running, inspect the journal and
any recovery copy, and only then remove that exact stale lock manually. Do not
automatically retry a stopped request. An interruption may leave state as
`writing`; the journal is the source for determining how far the write got.

The checks cover the formats and decoder actually exercised, not all possible
camera formats, embedded previews or downstream photo applications. Opaque
non-JPEG trailer data is byte-hashed but not decoded, and unrecognized
proprietary MakerNote-relative payloads are not independently decoded. RAW
image data may be intact while rendering depends on proprietary metadata. Keep that
metadata; never delete all RAW metadata. If a format cannot be decoded, image
data cannot be hashed, a stream cannot be preserved, or validation changes,
stop and retain the recovery copy instead of calling the file verified.

For paired writes, only a unique RAW with a matching basename and capture time
is eligible. Explicitly selected standalone CR2, ARW, DNG and TIFF photographs
do not need a pair; TIFF verification decodes all accessible pages and SubIFDs.
Read-only formats and ambiguous pairs are reported and skipped. A user-approved
description may overwrite that field; do not treat a low-confidence label as a
new reason to withhold an already approved description.

## Structural repairs versus new warnings

ExifTool may re-sort EXIF directories that a camera wrote out of order, which
also removes odd-offset findings, and it relocates embedded data when the
metadata grows. These are accepted only when proven:

- The only accepted write message is `Entries in <directory> were out of
  sequence. Fixed.`, and validation before the write must show that same
  directory out of order.
- Validation after the write may only *lose* ordering, out-of-sequence and
  odd-offset findings. Any new, changed or other removed finding fails the
  file. The journal lists the repaired findings in `repairedValidation`.
- MPF images (gain maps, previews, depth maps) and identifiable JPEGs after the
  primary image must be byte-identical and fully decodable; the full trailer,
  including padding, must hash identically; MPF offsets may change only by the
  primary image's size change. The EXIF thumbnail must be byte-identical.
- TIFF IFD offsets (strips, tiles, previews, thumbnails, `JpgFromRaw`) may move
  only when the referenced bytes hash identically. Moved offsets are listed in
  `relocatedMetadata`.
- For supported Sony ARW files, ExifTool's complete decrypted SR2 block must be
  identical after normalizing only validated directory pointers. Sony hidden
  data must also hash identically at the referenced offsets. Unsupported
  directory layouts are rejected.

A clean ExifTool refusal that leaves the file byte-identical is a skip, not a
success. Unparseable MPF indexes or payloads are skipped before writing.
