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

The `state.json.lock` directory coordinates this canvas and its Python helpers;
it does not lock other photo software. A crash may leave it in place. First
verify that no writer or canvas operation is running, inspect the journal and
any recovery copy, and only then remove that exact stale lock manually. Do not
automatically retry a stopped request. An interruption may leave state as
`writing`; the journal is the source for determining how far the write got.

The checks cover the formats and decoder actually exercised, not all possible
camera formats, embedded previews or downstream photo applications. RAW image
data may be intact while rendering depends on proprietary metadata. Keep that
metadata; never delete all RAW metadata. If a format cannot be decoded, image
data cannot be hashed, a stream cannot be preserved, or validation changes,
stop and retain the recovery copy instead of calling the file verified.

Only a unique RAW with a matching basename and capture time is eligible.
Read-only formats and ambiguous pairs are reported and skipped. A user-approved
description may overwrite that field; do not treat a low-confidence label as a
new reason to withhold an already approved description.
