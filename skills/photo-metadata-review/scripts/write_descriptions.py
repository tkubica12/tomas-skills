import argparse
import ctypes
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

import numpy
import rawpy
import tifffile
from PIL import Image

from common import (
    RAW_EXTENSIONS, capture_date, digest, exiftool, exiftool_path, exiftool_run, fingerprint,
    load_json, now, revision, safe_child, save_json, state_lock, valid_name,
)


IGNORED_METADATA = {
    "SourceFile", "IFD0:ImageDescription", "XMP-dc:Description", "XMP-x:XMPToolkit",
}
JPEG_FORMATS = ("JPEG", "MPO")
# Offset/length tag pairs in TIFF IFDs whose payloads must survive a rewrite byte-for-byte.
OFFSET_PAIRS = {
    "StripOffsets": "StripByteCounts", "TileOffsets": "TileByteCounts",
    "ThumbnailOffset": "ThumbnailLength", "PreviewImageStart": "PreviewImageLength",
    "JpgFromRawStart": "JpgFromRawLength", "OtherImageStart": "OtherImageLength",
}
TIFF_IFD = re.compile(r"(?:IFD\d+|SubIFD\d*)")
EXIF_DIRECTORIES = r"(?:IFD0|IFD1|ExifIFD|GPS|InteropIFD)"
# The only ExifTool write warning accepted: it re-sorted a directory that the
# camera wrote out of order. Validation must confirm the original disorder.
REPAIR_WRITE_WARNING = re.compile(
    rf"Warning: \[minor\] Entries in ({EXIF_DIRECTORIES}) were out of sequence\. Fixed\. - .+"
)
# Validation findings that a rewrite may legitimately remove: entry ordering
# and odd value offsets. Any other removed, new or changed finding fails.
REPAIRABLE_VALIDATION = (
    re.compile(rf"Entries in {EXIF_DIRECTORIES} are out of order(?: \[x\d+\])?"),
    re.compile(rf"Tag ID 0x[0-9a-f]{{4}}(?: \w+)? out of sequence in {EXIF_DIRECTORIES}"),
    re.compile(rf"\[minor\] Odd offset for {EXIF_DIRECTORIES} tag 0x[0-9a-f]{{4}}(?: \w+)?"),
)
VALIDATION_SUMMARY = re.compile(r"OK|(?:\d+ Errors?(?:, )?)?(?:\d+ Warnings?(?: \((?:\d+|all) minor\))?)?")


class SafetySkip(Exception):
    pass


class WriteRefused(Exception):
    """ExifTool refused the file and it was proven byte-identical afterwards."""


class UnsafeWrite(RuntimeError):
    """A write would introduce unapproved metadata changes or warnings."""


class UnsafeMetadataChange(UnsafeWrite):
    def __init__(self, changed):
        self.changed = changed
        super().__init__(f"Unexpected metadata changes: {', '.join(changed)}")


def extra_data(path):
    if os.name == "nt":
        from ctypes import wintypes

        class StreamData(ctypes.Structure):
            _fields_ = [("size", ctypes.c_longlong), ("name", ctypes.c_wchar * 296)]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.FindFirstStreamW.argtypes = [wintypes.LPCWSTR, ctypes.c_int, ctypes.POINTER(StreamData), wintypes.DWORD]
        kernel.FindFirstStreamW.restype = wintypes.HANDLE
        kernel.FindNextStreamW.argtypes = [wintypes.HANDLE, ctypes.POINTER(StreamData)]
        kernel.FindNextStreamW.restype = wintypes.BOOL
        kernel.FindClose.argtypes = [wintypes.HANDLE]
        kernel.FindClose.restype = wintypes.BOOL
        data = StreamData()
        handle = kernel.FindFirstStreamW(str(path), 0, ctypes.byref(data), 0)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        streams = {}
        try:
            while True:
                if data.name != "::$DATA":
                    streams[data.name] = {"size": data.size, "sha256": digest(Path(str(path) + data.name))}
                if not kernel.FindNextStreamW(handle, ctypes.byref(data)):
                    error = ctypes.get_last_error()
                    if error != 38:
                        raise ctypes.WinError(error)
                    break
        finally:
            kernel.FindClose(handle)
        return streams
    if not hasattr(os, "listxattr") or not hasattr(os, "getxattr"):
        raise RuntimeError("Cannot verify extended attributes on this operating system")
    return {
        name: hashlib.sha256(os.getxattr(path, name)).hexdigest()
        for name in sorted(os.listxattr(path))
    }


def copy_original(source, destination):
    if os.name == "nt":
        from ctypes import wintypes

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CopyFileW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.BOOL]
        kernel.CopyFileW.restype = wintypes.BOOL
        if not kernel.CopyFileW(str(source), str(destination), True):
            raise ctypes.WinError(ctypes.get_last_error())
    else:
        with source.open("rb") as src, destination.open("xb") as dst:
            shutil.copyfileobj(src, dst, 4 * 1024 * 1024)
        shutil.copystat(source, destination)


def metadata(tool, path):
    entries = json.loads(exiftool(tool, [
        "-json", "-G1", "-a", "-u", "-n", "-api", "ImageHashType=SHA256",
        "-all", "-ImageDataHash", path,
    ]))
    if len(entries) != 1 or entries[0].get("ExifTool:Error"):
        raise SafetySkip(f"ExifTool could not read {path.name}")
    entry = entries[0]
    image_hash = entry.get("File:ImageDataHash")
    if not isinstance(image_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", image_hash):
        raise SafetySkip(f"ExifTool cannot verify the image-data hash for {path.name}")
    pairs = []
    for key, value in entry.items():
        group, _, tag = key.partition(":")
        if tag in OFFSET_PAIRS and TIFF_IFD.fullmatch(group) and (
            str(value).startswith("(Binary data ")
            or str(entry.get(f"{group}:{OFFSET_PAIRS[tag]}")).startswith("(Binary data ")
        ):
            pairs.extend((key, f"{group}:{OFFSET_PAIRS[tag]}"))
    if pairs:
        expanded = json.loads(exiftool(tool, [
            "-json", "-G1", "-a", "-n", "-b", *(f"-{key}" for key in pairs), path,
        ]))
        if len(expanded) != 1 or any(key not in expanded[0] for key in pairs):
            raise SafetySkip(f"ExifTool cannot expand image offsets for {path.name}")
        entry.update({key: expanded[0][key] for key in pairs})
    return entry


def validation(tool, path):
    return sorted(exiftool(tool, ["-a", "-s3", "-validate", "-warning", "-error", path]).splitlines())


def compare_validation(before, after, repaired_directories=()):
    """Allow only removal of repairable ordering/offset findings; return what was repaired."""
    findings_before = [line for line in before if not VALIDATION_SUMMARY.fullmatch(line)]
    findings_after = [line for line in after if not VALIDATION_SUMMARY.fullmatch(line)]
    remaining = list(findings_before)
    added = []
    for line in findings_after:
        if line in remaining:
            remaining.remove(line)
        else:
            added.append(line)
    if added:
        raise RuntimeError(f"New or changed ExifTool validation findings: {'; '.join(added)}")
    unexplained = [line for line in remaining if not any(p.fullmatch(line) for p in REPAIRABLE_VALIDATION)]
    if unexplained:
        raise RuntimeError(f"Validation findings disappeared without a known repair: {'; '.join(unexplained)}")
    for directory in repaired_directories:
        if not any(re.fullmatch(rf"Entries in {directory} are out of order(?: \[x\d+\])?", line) for line in findings_before):
            raise RuntimeError(f"ExifTool reported repairing {directory}, which was not out of order")
    return sorted(remaining)


def jpeg_end(data, start=0):
    """Return the offset just after the EOI of the JPEG stream beginning at start."""
    size = len(data)
    if data[start:start + 2] != b"\xff\xd8":
        raise SafetySkip("Embedded data does not start with a JPEG marker")
    position = start + 2
    while True:
        if position + 2 > size or data[position] != 0xFF:
            raise SafetySkip("Malformed JPEG marker structure")
        marker = data[position + 1]
        if marker == 0xFF:
            position += 1
            continue
        if marker == 0xD9:
            return position + 2
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            position += 2
            continue
        if position + 4 > size:
            raise SafetySkip("Truncated JPEG segment")
        length = int.from_bytes(data[position + 2:position + 4], "big")
        position += 2 + length
        if length < 2 or position > size:
            raise SafetySkip("Truncated JPEG segment")
        if marker == 0xDA:
            while True:
                position = data.find(b"\xff", position)
                if position < 0 or position + 1 >= size:
                    raise SafetySkip("JPEG scan has no end marker")
                following = data[position + 1]
                if following == 0x00 or 0xD0 <= following <= 0xD7:
                    position += 2
                elif following == 0xFF:
                    position += 1
                else:
                    break


def mpf_entries(data, primary_end):
    """Parse the primary image's MPF index; offsets are made file-absolute."""
    position = 2
    while position + 4 <= primary_end and data[position] == 0xFF and data[position + 1] not in (0xDA, 0xD9):
        length = int.from_bytes(data[position + 2:position + 4], "big")
        if data[position + 1] == 0xE2 and data[position + 4:position + 8] == b"MPF\0":
            base = position + 8
            segment_end = position + 2 + length
            order = {b"II": "little", b"MM": "big"}.get(data[base:base + 2])
            if order is None or int.from_bytes(data[base + 2:base + 4], order) != 42:
                raise SafetySkip("Malformed MPF header")
            number = lambda offset, width: int.from_bytes(data[base + offset:base + offset + width], order)
            directory = number(4, 4)
            count = number(directory, 2)
            if base + directory + 2 + 12 * count > segment_end:
                raise SafetySkip("Malformed MPF index")
            entries = None
            for index in range(count):
                tag_at = directory + 2 + 12 * index
                if number(tag_at, 2) == 0xB002:
                    total, offset = number(tag_at + 4, 4), number(tag_at + 8, 4)
                    if total % 16 or base + offset + total > segment_end:
                        raise SafetySkip("Malformed MPF entry list")
                    entries = []
                    for item in range(total // 16):
                        at = offset + 16 * item
                        attribute, length_value, start = number(at, 4), number(at + 4, 4), number(at + 8, 4)
                        absolute = 0 if start == 0 else base + start
                        if item and (
                            absolute < primary_end or absolute + length_value > len(data)
                            or data[absolute:absolute + 2] != b"\xff\xd8"
                        ):
                            raise SafetySkip("An MPF image points outside the file trailer")
                        entries.append({
                            "attribute": attribute, "length": length_value, "start": absolute,
                            "sha256": None if not item else hashlib.sha256(data[absolute:absolute + length_value]).hexdigest(),
                        })
            if entries is None or not entries or entries[0]["start"] != 0:
                raise SafetySkip("MPF index does not start with the primary image")
            return entries
        position += 2 + length
    return []


def decoded_bytes(stream, name):
    digest_value = hashlib.sha256()
    try:
        with Image.open(stream) as image:
            if image.format not in JPEG_FORMATS:
                raise SafetySkip(f"Not a JPEG: {name}")
            image.load()
            digest_value.update(f"{image.mode}:{image.size}".encode("ascii"))
            digest_value.update(image.tobytes())
    except (OSError, ValueError, SyntaxError) as error:
        raise SafetySkip(f"Cannot fully decode {name}: {error}") from error
    return digest_value.hexdigest()


def jpeg_structure(path, entry):
    """Describe every embedded JPEG payload so a rewrite can prove it was preserved."""
    data = path.read_bytes()
    primary_end = jpeg_end(data)
    trailer = data[primary_end:]
    embedded = []
    position = 0
    while True:
        position = trailer.find(b"\xff\xd8", position)
        if position < 0:
            break
        stop = jpeg_end(trailer, position)
        payload = trailer[position:stop]
        embedded.append({
            "start": primary_end + position, "length": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "decodedSha256": decoded_bytes(io.BytesIO(payload), f"embedded image in {path.name}"),
        })
        position = stop
    mpf = mpf_entries(data, primary_end)
    for item in mpf[1:]:
        # Canon pads between images with arbitrary bytes; the MPF index locates those payloads.
        if not any(e["start"] == item["start"] for e in embedded):
            if jpeg_end(data, item["start"]) != item["start"] + item["length"]:
                raise SafetySkip(f"An MPF image is not a complete embedded JPEG in {path.name}")
            embedded.append({
                "start": item["start"], "length": item["length"], "sha256": item["sha256"],
                "decodedSha256": decoded_bytes(
                    io.BytesIO(data[item["start"]:item["start"] + item["length"]]),
                    f"MPF image in {path.name}",
                ),
            })
    embedded.sort(key=lambda e: e["start"])
    for index, item in enumerate(mpf[1:], start=2):
        if (
            entry.get(f"MPImage{index}:MPImageStart") != item["start"]
            or entry.get(f"MPImage{index}:MPImageLength") != item["length"]
        ):
            raise SafetySkip(f"ExifTool and the MPF index disagree in {path.name}")
        if not any(e["start"] == item["start"] and e["length"] == item["length"] for e in embedded):
            raise SafetySkip(f"An MPF image is not a complete embedded JPEG in {path.name}")
    thumbnail = None
    offset, length = entry.get("IFD1:ThumbnailOffset"), entry.get("IFD1:ThumbnailLength")
    if isinstance(offset, int) and isinstance(length, int) and length > 0:
        if offset + length > primary_end:
            raise SafetySkip(f"EXIF thumbnail lies outside the primary image in {path.name}")
        payload = data[offset:offset + length]
        thumbnail = {
            "length": length, "sha256": hashlib.sha256(payload).hexdigest(),
            "decodedSha256": decoded_bytes(io.BytesIO(payload), f"EXIF thumbnail in {path.name}")
            if payload[:2] == b"\xff\xd8" else None,
        }
    return {
        "primaryEnd": primary_end,
        "trailerLength": len(trailer),
        "trailerSha256": hashlib.sha256(trailer).hexdigest(),
        "embedded": embedded,
        "mpf": mpf,
        "thumbnail": thumbnail,
    }


def compare_structure(before, after):
    """Require identical embedded payloads; only their absolute offsets may move."""
    def payloads(structure):
        return {
            "trailer": (structure["trailerLength"], structure["trailerSha256"]),
            "embedded": [(e["length"], e["sha256"], e["decodedSha256"]) for e in structure["embedded"]],
            "mpf": [(m["attribute"], m["length"], m["sha256"]) for m in structure["mpf"]],
            "thumbnail": structure["thumbnail"],
        }
    if payloads(before) != payloads(after):
        raise RuntimeError("Embedded images, MPF payloads, trailer or EXIF thumbnail changed")
    shift = after["primaryEnd"] - before["primaryEnd"]
    if any(b["start"] + shift != a["start"] for b, a in zip(before["mpf"][1:], after["mpf"][1:])):
        raise RuntimeError("MPF images were not relocated consistently with the primary image")
    return {
        f"MPImage{index}:MPImageStart": [b["start"], a["start"]]
        for index, (b, a) in enumerate(zip(before["mpf"][1:], after["mpf"][1:]), start=2)
        if b["start"] != a["start"]
    }


def offset_payloads(path, entry):
    """Hash every IFD strip/tile/preview payload addressed by an offset/length pair."""
    def integers(value):
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            return [value]
        if isinstance(value, str) and re.fullmatch(r"\d+(?: \d+)*", value):
            return [int(item) for item in value.split()]
        return None

    data = path.read_bytes()
    payloads = {}
    for key, value in entry.items():
        group, _, tag = key.partition(":")
        if not (
            tag in OFFSET_PAIRS and TIFF_IFD.fullmatch(group)
            or key == "Sony:HiddenDataOffset"
        ):
            continue
        length_tag = "HiddenDataLength" if key == "Sony:HiddenDataOffset" else OFFSET_PAIRS[tag]
        offsets, sizes = integers(value), integers(entry.get(f"{group}:{length_tag}"))
        if offsets is None or sizes is None or not offsets or len(offsets) != len(sizes) or any(size == 0 for size in sizes):
            raise SafetySkip(f"Cannot locate the {key} payload in {path.name}")
        digest_value = hashlib.sha256()
        decoded = []
        for offset, size in zip(offsets, sizes):
            if offset + size > len(data):
                raise SafetySkip(f"The {key} payload lies outside {path.name}")
            payload = data[offset:offset + size]
            digest_value.update(payload)
            decoded.append(decoded_bytes(io.BytesIO(payload), f"{key} in {path.name}")
                           if tag in {"ThumbnailOffset", "PreviewImageStart", "JpgFromRawStart", "OtherImageStart"}
                           and payload[:2] == b"\xff\xd8" else None)
        payloads[key] = {"sizes": sizes, "sha256": digest_value.hexdigest(), "decodedSha256": decoded}
    return payloads


def compare_payloads(before, after, entry_before, entry_after):
    """Payloads must be identical; return offsets that moved only because data was relocated."""
    if before != after:
        raise RuntimeError("Strip, tile, preview or thumbnail payloads changed")
    return {
        key: [entry_before[key], entry_after[key]]
        for key in before if entry_before[key] != entry_after.get(key)
    }


def normalized_sony_ifds(data, base, order):
    """Normalize only TIFF directory pointers in a decrypted Sony SR2 block."""
    source = bytes(data)
    normalized = bytearray(source)
    widths = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4}
    visited = set()
    directories, values, pointers = [], [], []

    def number(at, length):
        if at < 0 or at + length > len(source):
            raise SafetySkip("Sony SR2 directory is out of bounds")
        return int.from_bytes(source[at:at + length], order)

    def pointer(at, length):
        relative = number(at, 4) - base
        if relative < 0 or relative + length > len(source):
            raise SafetySkip("Sony SR2 payload is outside its decrypted block")
        pointers.append((at, at + 4))
        normalized[at:at + 4] = relative.to_bytes(4, order)
        return relative

    def directory(start, depth):
        if depth > 1 or start in visited:
            raise SafetySkip("Unsupported Sony SR2 directory graph")
        visited.add(start)
        count = number(start, 2)
        if count > 4096 or start + 2 + count * 12 + 4 > len(source):
            raise SafetySkip("Malformed Sony SR2 directory")
        directories.append((start, start + 2 + count * 12 + 4))
        for index in range(count):
            at = start + 2 + index * 12
            tag, fmt, amount = number(at, 2), number(at + 2, 2), number(at + 4, 4)
            if fmt not in widths:
                raise SafetySkip("Unsupported Sony SR2 field type")
            length = widths[fmt] * amount
            if tag == 0x74C0:
                if depth or fmt != 4 or not amount:
                    raise SafetySkip("Unsupported Sony SR2 subdirectory list")
                location = pointer(at + 8, length) if length > 4 else at + 8
                for item in range(amount):
                    directory(pointer(location + item * 4, 2), depth + 1)
            elif length > 4:
                location = pointer(at + 8, length)
                values.append((location, location + length))

    directory(0, 0)
    if any(a < d and c < b for i, (a, b) in enumerate(directories) for c, d in directories[i + 1:]):
        raise SafetySkip("Overlapping Sony SR2 directories")
    if any(a < d and c < b for a, b in pointers for c, d in values):
        raise SafetySkip("Sony SR2 pointer overlaps metadata values")
    return hashlib.sha256(normalized).hexdigest()


def sony_sr2_structure(tool, path, entry):
    key = "SR2:SR2SubIFDOffset"
    if key not in entry:
        return None
    offset, length = entry[key], entry.get("SR2:SR2SubIFDLength")
    if not isinstance(offset, int) or not isinstance(length, int) or offset < 0 or not 0 < length <= 16 * 1024 * 1024:
        raise SafetySkip(f"Unsupported Sony SR2 block in {path.name}")
    if offset + length > path.stat().st_size:
        raise SafetySkip(f"Sony SR2 block is outside {path.name}")
    with path.open("rb") as source:
        order = {b"II": "little", b"MM": "big"}.get(source.read(2))
    if order is None:
        raise SafetySkip(f"Unsupported Sony SR2 byte order in {path.name}")
    code, output, error = exiftool_run(tool, ["-v5", path])
    if code or error:
        raise SafetySkip(f"Cannot inspect Sony SR2 data in {path.name}: {error}")
    lines = output.splitlines()
    headers = [i for i, line in enumerate(lines) if "[Decrypted SR2SubIFD directory," in line]
    if len(headers) != 1 or not re.search(rf"\b{length} bytes\]", lines[headers[0]]):
        raise SafetySkip(f"Cannot identify the decrypted Sony SR2 block in {path.name}")
    data = bytearray()
    for line in lines[headers[0] + 1:]:
        match = re.match(r"\s*\|\s*\|\s+([0-9a-f]+):\s*((?:[0-9a-f]{2}\s+){1,16})", line)
        if not match:
            break
        if int(match.group(1), 16) != offset + len(data):
            raise SafetySkip(f"Noncontiguous Sony SR2 dump in {path.name}")
        data.extend(bytes.fromhex(match.group(2)))
    if len(data) != length:
        raise SafetySkip(f"Incomplete Sony SR2 dump in {path.name}")
    return {"offset": offset, "length": length, "normalizedSha256": normalized_sony_ifds(data, offset, order)}


def compare_sony_sr2(before, after):
    if before is None and after is None:
        return {}
    if before is None or after is None or any(before[k] != after[k] for k in ("length", "normalizedSha256")):
        raise RuntimeError("Sony SR2 metadata payload changed")
    return {"SR2:SR2SubIFDOffset": [before["offset"], after["offset"]]} if before["offset"] != after["offset"] else {}


def decoded_hash(path, kind, before):
    digest_value = hashlib.sha256()
    if kind == "JPG":
        return decoded_bytes(path, path.name)
    if kind == "TIFF":
        try:
            with tifffile.TiffFile(path) as container:
                if not len(container.pages):
                    raise SafetySkip(f"TIFF has no image pages: {path.name}")

                def hash_pages(pages, prefix):
                    for index, page in enumerate(pages):
                        pixels = numpy.ascontiguousarray(page.asarray())
                        digest_value.update(f"{prefix}/{index}:{pixels.shape}:{pixels.dtype}".encode("ascii"))
                        digest_value.update(memoryview(pixels).cast("B"))
                        if page.pages is not None:
                            hash_pages(page.pages, f"{prefix}/{index}")

                hash_pages(container.pages, "")
            return digest_value.hexdigest()
        except (tifffile.TiffFileError, OSError, ValueError, ImportError, NotImplementedError, KeyError) as error:
            raise SafetySkip(f"Cannot fully decode TIFF pages in {path.name}: {error}") from error
    try:
        with rawpy.imread(str(path)) as raw:
            pixels = numpy.ascontiguousarray(raw.raw_image)
            digest_value.update(f"{pixels.shape}:{pixels.dtype}".encode("ascii"))
            digest_value.update(memoryview(pixels).cast("B"))
        return digest_value.hexdigest()
    except rawpy.LibRawError as error:
        if path.suffix.lower() != ".dng":
            raise SafetySkip(f"LibRaw cannot fully decode {path.name}: {error}") from error
        raw_error = error
    try:
        with tifffile.TiffFile(path) as container:
            page = container.pages[0]
            if (
                int(page.photometric) != 34892 or page.samplesperpixel < 3
                or page.subfiletype not in (0, None)
                or before.get("IFD0:ImageWidth") != page.imagewidth
                or before.get("IFD0:ImageHeight") != page.imagelength
            ):
                raise SafetySkip(f"Unsupported DNG raw image in {path.name}: {raw_error}")
            pixels = numpy.ascontiguousarray(page.asarray())
            if pixels.shape[0] != page.imagelength or pixels.shape[1] != page.imagewidth:
                raise SafetySkip(f"Could not decode the full linear DNG in {path.name}")
            digest_value.update(f"{pixels.shape}:{pixels.dtype}".encode("ascii"))
            digest_value.update(memoryview(pixels).cast("B"))
        return digest_value.hexdigest()
    except (tifffile.TiffFileError, OSError, ValueError) as error:
        raise SafetySkip(f"Cannot fully decode {path.name}: {error}") from error


def compare_metadata(before, after, relocated=()):
    changed = sorted(
        key for key in before.keys() | after.keys()
        if key not in IGNORED_METADATA and key not in relocated and not key.startswith("System:")
        and before.get(key) != after.get(key)
    )
    if changed:
        raise UnsafeMetadataChange(changed)


def writable_extensions(tool):
    output = exiftool(tool, ["-listwf"])
    if ":" not in output:
        raise RuntimeError("Cannot determine ExifTool writable formats")
    return set(output.split(":", 1)[1].upper().split())


def request_signature(request):
    frozen = {key: request[key] for key in ("id", "approvedAt", "photoDirectory", "rawDirectory", "photos")}
    return hashlib.sha256(json.dumps(frozen, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def approved_request(state, request_id):
    request = state.get("writeRequest")
    if not isinstance(request, dict) or request.get("id") != request_id or request.get("status") != "pending":
        raise ValueError("The exact write request is not pending")
    if not re.fullmatch(r"[a-f0-9-]{36}", request_id):
        raise ValueError("Invalid request ID")
    if request.get("photoDirectory") != state.get("photoDirectory") or request.get("rawDirectory") != state.get("rawDirectory"):
        raise ValueError("The approved directories no longer match the review")
    photos = request.get("photos")
    if not isinstance(photos, list) or not photos:
        raise ValueError("The approved photo list is empty")
    if state.get("photos") != photos:
        raise ValueError("The displayed photos changed after approval")
    names = []
    for photo in photos:
        if not isinstance(photo, dict) or not valid_name(photo.get("id")):
            raise ValueError("Invalid approved JPEG name")
        name = photo["id"]
        text = photo.get("description")
        if (
            Path(name).suffix.lower() not in (".jpg", ".jpeg", ".cr2", ".arw", ".dng", ".tif", ".tiff")
            or not isinstance(text, str) or not text.strip() or len(text) > 4000
            or any(char in text for char in "\r\n\0")
            or not isinstance(photo.get("fingerprint"), dict)
            or not isinstance(photo.get("rawMatches"), list)
            or not isinstance(photo.get("rawCandidates"), list)
        ):
            raise ValueError(f"Invalid approved record: {name}")
        if Path(name).suffix.lower() in (".cr2", ".arw", ".dng", ".tif", ".tiff") and (
            request["rawDirectory"] or photo["rawMatches"] or photo["rawCandidates"]
        ):
            raise ValueError(f"Standalone photos cannot have RAW pairs: {name}")
        names.append(os.path.normcase(name))
    if len(names) != len(set(names)):
        raise ValueError("The approved list contains duplicate JPEGs")
    return request


def skipped(records, photo, kind, name, reason):
    records.append({"photo": photo, "kind": kind, "name": name, "status": "skipped", "reason": str(reason)})


def check_source(path, baseline):
    if fingerprint(path) != baseline:
        raise SafetySkip(f"File changed since the review was prepared: {path.name}")


def unique_pair(photo_root, raw_root, jpg, raw_name):
    stem = os.path.normcase(jpg.stem)
    raws = [
        item.name for item in raw_root.iterdir()
        if item.suffix.lower() in RAW_EXTENSIONS and os.path.normcase(item.stem) == stem
    ]
    jpgs = [
        item.name for item in photo_root.iterdir()
        if item.suffix.lower() in (".jpg", ".jpeg") and os.path.normcase(item.stem) == stem
    ]
    return len(raws) == 1 and os.path.normcase(raws[0]) == os.path.normcase(raw_name) and len(jpgs) == 1


def file_preflight(tool, path, kind, baseline, writable):
    check_source(path, baseline)
    extension = path.suffix[1:].upper()
    if extension not in writable:
        raise SafetySkip(f"ExifTool cannot write this format: {path.name}")
    before = metadata(tool, path)
    expected = "JPEG" if kind == "JPG" else "TIFF" if kind == "TIFF" else extension
    if before.get("File:FileType") != expected:
        raise SafetySkip(f"File content does not match the extension: {path.name}")
    decoded = decoded_hash(path, kind, before)
    structure = {
        "jpeg": jpeg_structure(path, before) if kind == "JPG" else None,
        "payloads": offset_payloads(path, before),
        "sonySr2": sony_sr2_structure(tool, path, before),
    }
    warnings = validation(tool, path)
    attributes = extra_data(path)
    check_source(path, baseline)
    return before, decoded, warnings, attributes, structure


def write_file(tool, source, kind, text, baseline, preflight, recovery, records, journal_path, journal, check_state,
               no_mandatory=False):
    before, decoded_before, warnings_before, attributes_before, structure_before = preflight
    backup = recovery / f"{uuid.uuid4().hex}-{source.name}"
    record = {
        "photo": journal["currentPhoto"], "kind": kind, "name": source.name,
        "status": "backing_up", "recoveryCopy": str(backup),
        "sha256Before": baseline["sha256"],
    }
    if no_mandatory:
        record["exiftoolNoMandatory"] = True
    records.append(record)
    save_json(journal_path, journal)
    copy_original(source, backup)
    if digest(backup) != baseline["sha256"] or extra_data(backup) != attributes_before:
        raise RuntimeError(f"Recovery-copy verification failed: {source.name}")
    check_source(source, baseline)
    check_state()
    record["status"] = "writing"
    save_json(journal_path, journal)
    options = ["-api", "NoMandatory=1"] if no_mandatory else []
    code, output, stderr = exiftool_run(tool, [
        *options,
        "-overwrite_original_in_place",
        f"-IFD0:ImageDescription={text}",
        f"-XMP-dc:Description-x-default={text}",
        source,
    ])
    record["status"] = "written_unverified"
    save_json(journal_path, journal)
    repair_warnings = [REPAIR_WRITE_WARNING.fullmatch(line) for line in stderr.splitlines()]
    if code and any(line.startswith("Error: ") for line in stderr.splitlines()) and "0 image files updated" in output:
        # A clean refusal (e.g. a broken IFD0 pointer) is a skip only when nothing changed.
        check_source(source, baseline)
        if digest(source) == baseline["sha256"] and extra_data(source) == attributes_before:
            reason = " ".join(line.split(" - ")[0] for line in stderr.splitlines() if line.startswith("Error: "))
            record.update({"status": "skipped", "reason": f"ExifTool refused the file unchanged: {reason}"})
            save_json(journal_path, journal)
            backup.unlink()
            record["recoveryCopyRemoved"] = True
            save_json(journal_path, journal)
            raise WriteRefused(reason)
    if code:
        raise RuntimeError(f"ExifTool exit {code}: {stderr}")
    if not all(repair_warnings):
        raise UnsafeWrite(f"ExifTool exit {code}: {stderr}")
    repaired_directories = sorted({match.group(1) for match in repair_warnings})
    if "1 image files updated" not in output and "1 image files unchanged" not in output:
        raise RuntimeError(f"Unexpected ExifTool result for {source.name}: {output.strip()}")
    after_write = source.stat()
    if str(after_write.st_dev) != baseline["device"] or str(after_write.st_ino) != baseline["inode"]:
        raise RuntimeError(f"File identity changed during the write: {source.name}")
    after = metadata(tool, source)
    if after.get("IFD0:ImageDescription") != text or after.get("XMP-dc:Description") != text:
        raise RuntimeError(f"Description did not round-trip: {source.name}")
    if after["File:ImageDataHash"] != before["File:ImageDataHash"]:
        raise RuntimeError(f"Image-data hash changed: {source.name}")
    relocated = {}
    if structure_before is not None:
        if structure_before["jpeg"] is not None:
            relocated.update(compare_structure(structure_before["jpeg"], jpeg_structure(source, after)))
        relocated.update(compare_payloads(
            structure_before["payloads"], offset_payloads(source, after), before, after,
        ))
        relocated.update(compare_sony_sr2(structure_before["sonySr2"], sony_sr2_structure(tool, source, after)))
    compare_metadata(before, after, relocated)
    repaired_validation = compare_validation(warnings_before, validation(tool, source), repaired_directories)
    if extra_data(source) != attributes_before or extra_data(backup) != attributes_before:
        raise RuntimeError(f"Filesystem streams or attributes changed: {source.name}")
    if decoded_hash(source, kind, before) != decoded_before:
        raise RuntimeError(f"Decoded image data changed: {source.name}")
    after_fingerprint = fingerprint(source)
    if (
        after_fingerprint["size"] != after_write.st_size
        or after_fingerprint["mtimeNs"] != str(after_write.st_mtime_ns)
        or after_fingerprint["device"] != str(after_write.st_dev)
        or after_fingerprint["inode"] != str(after_write.st_ino)
    ):
        raise RuntimeError(f"File changed during verification: {source.name}")
    check_state()
    record.update({
        "status": "verified",
        "sha256After": after_fingerprint["sha256"],
        "imageDataSha256": after["File:ImageDataHash"],
        "decodedSha256": decoded_before,
        "fingerprintAfter": after_fingerprint,
        "exiftoolRepairs": repaired_directories,
        "repairedValidation": repaired_validation,
        "relocatedMetadata": relocated,
        "embeddedImagesVerified": len(structure_before["jpeg"]["embedded"]) if structure_before and structure_before["jpeg"] else 0,
        "payloadsVerified": len(structure_before["payloads"]) if structure_before else 0,
        "verifiedAt": now(),
    })
    save_json(journal_path, journal)
    backup.unlink()
    record["recoveryCopyRemoved"] = True
    save_json(journal_path, journal)
    return after_fingerprint


def trial_jpeg_write(tool, source, text, baseline, preflight, writable, recovery, check_state):
    """Prove the approved write on a private copy before writing the source."""
    check_source(source, baseline)
    with tempfile.TemporaryDirectory(prefix="photo-write-trial-", dir=recovery.parent) as directory:
        reason = None
        no_mandatory = False
        for no_mandatory in (False, True):
            trial_root = Path(directory) / ("no-mandatory" if no_mandatory else "default")
            trial_root.mkdir()
            trial = trial_root / source.name
            copy_original(source, trial)
            trial_fingerprint = fingerprint(trial)
            if trial_fingerprint["sha256"] != baseline["sha256"] or extra_data(trial) != preflight[3]:
                raise RuntimeError(f"Trial-copy verification failed: {source.name}")
            trial_ready = file_preflight(tool, trial, "JPG", trial_fingerprint, writable)
            trial_recovery = trial_root / "recovery"
            trial_recovery.mkdir()
            trial_records = []
            trial_journal = {"currentPhoto": source.name, "files": trial_records}
            try:
                write_file(
                    tool, trial, "JPG", text, trial_fingerprint, trial_ready, trial_recovery,
                    trial_records, trial_root / "journal.json", trial_journal, check_state,
                    no_mandatory=no_mandatory,
                )
                break
            except UnsafeMetadataChange as error:
                if (not no_mandatory and error.changed == ["IFD0:YCbCrPositioning"]
                        and "IFD0:YCbCrPositioning" not in preflight[0]):
                    continue
                reason = str(error).strip()
                break
            except (UnsafeWrite, WriteRefused) as error:
                reason = str(error).strip()
                break
        check_source(source, baseline)
        if extra_data(source) != preflight[3]:
            raise SafetySkip(f"Filesystem streams changed since preflight: {source.name}")
        check_state()
        if reason is not None:
            raise SafetySkip(f"Private trial write was unsafe; source not written: {reason}")
        return no_mandatory


def result_for(records, journal_path, error=None):
    result = {
        "verifiedJpg": sum(r["status"] == "verified" and r["kind"] == "JPG" for r in records),
        "verifiedRaw": sum(r["status"] == "verified" and r["kind"] == "RAW" for r in records),
        "verifiedTiff": sum(r["status"] == "verified" and r["kind"] == "TIFF" for r in records),
        "skippedJpg": sum(r["status"] == "skipped" and r["kind"] == "JPG" for r in records),
        "skippedRaw": sum(r["status"] == "skipped" and r["kind"] == "RAW" for r in records),
        "skippedTiff": sum(r["status"] == "skipped" and r["kind"] == "TIFF" for r in records),
        "repairedValidation": sum(r["status"] == "verified" and bool(r.get("repairedValidation")) for r in records),
        "failed": 1 if error else 0,
        "journal": str(journal_path),
        "finishedAt": now(),
    }
    if error:
        result["message"] = error
        result["recoveryCopies"] = [
            r["recoveryCopy"] for r in records
            if r.get("recoveryCopy") and Path(r["recoveryCopy"]).is_file()
        ]
    return result


def run(state_path, request_id, tool):
    state_path = Path(state_path).expanduser().resolve(strict=True)
    with state_lock(state_path):
        state = load_json(state_path)
        request = approved_request(state, request_id)
        signature = request_signature(request)
        photo_root = Path(request["photoDirectory"]).resolve(strict=True)
        raw_root = Path(request["rawDirectory"]).resolve(strict=True) if request["rawDirectory"] else None
        if not photo_root.is_dir() or (raw_root and not raw_root.is_dir()):
            raise ValueError("An approved photo directory no longer exists")
        writable = writable_extensions(tool)
        journal_path = state_path.parent / f"journal-{request_id}.json"
        if journal_path.exists():
            raise FileExistsError("A journal for this request already exists; inspect it rather than retrying")
        recovery = state_path.parent / "recovery"
        recovery.mkdir(mode=0o700, exist_ok=True)
        records = []
        journal = {
            "requestId": request_id, "signature": signature, "status": "writing",
            "startedAt": now(), "files": records,
        }
        save_json(journal_path, journal)
        request["status"] = "writing"
        request["result"] = {"journal": str(journal_path)}
        save_json(state_path, state)
        expected_state_revision = revision(state_path)

        def check_state():
            if revision(state_path) != expected_state_revision:
                raise RuntimeError("Review state changed during the approved write; it was not overwritten")

        current_photos = {photo["id"]: photo for photo in state["photos"]}
        seen_raw = set()
        try:
            for photo in request["photos"]:
                journal["currentPhoto"] = photo["id"]
                suffix = Path(photo["id"]).suffix.lower()
                if suffix in (".cr2", ".arw", ".dng", ".tif", ".tiff"):
                    kind = "TIFF" if suffix in (".tif", ".tiff") else "RAW"
                    try:
                        source = safe_child(photo_root, photo["id"])
                        ready = file_preflight(tool, source, kind, photo["fingerprint"], writable)
                    except (SafetySkip, FileNotFoundError, ValueError, OSError) as error:
                        skipped(records, photo["id"], kind, photo["id"], error)
                        save_json(journal_path, journal)
                        continue
                    try:
                        current_photos[photo["id"]]["fingerprint"] = write_file(
                            tool, source, kind, photo["description"], photo["fingerprint"],
                            ready, recovery, records, journal_path, journal, check_state,
                        )
                    except WriteRefused:
                        pass
                    save_json(journal_path, journal)
                    continue
                try:
                    jpg = safe_child(photo_root, photo["id"])
                    jpg_ready = file_preflight(tool, jpg, "JPG", photo["fingerprint"], writable)
                except (SafetySkip, FileNotFoundError, ValueError, OSError) as error:
                    skipped(records, photo["id"], "JPG", photo["id"], error)
                    if raw_root:
                        skipped(records, photo["id"], "RAW", None, "JPEG is unavailable or changed")
                    save_json(journal_path, journal)
                    continue
                raw_ready = None
                raw = None
                if raw_root:
                    matches = photo["rawMatches"]
                    candidates = photo["rawCandidates"]
                    stem = os.path.normcase(jpg.stem)
                    if (
                        photo.get("ambiguousJpgStem") or len(matches) != 1 or len(candidates) != 1
                        or not valid_name(matches[0]) or candidates[0].get("name") != matches[0]
                        or Path(matches[0]).suffix.lower() not in RAW_EXTENSIONS
                        or os.path.normcase(Path(matches[0]).stem) != stem
                        or os.path.normcase(matches[0]) in seen_raw
                        or not unique_pair(photo_root, raw_root, jpg, matches[0])
                    ):
                        skipped(records, photo["id"], "RAW", None, "RAW pairing is missing or ambiguous")
                    else:
                        try:
                            raw = safe_child(raw_root, matches[0])
                            raw_ready = file_preflight(tool, raw, "RAW", candidates[0]["fingerprint"], writable)
                            dates = [capture_date(jpg_ready[0]), capture_date(raw_ready[0])]
                            if not dates[0] or dates[0] != dates[1] or dates[0] != photo.get("date"):
                                raise SafetySkip("JPEG and RAW capture times do not match")
                            seen_raw.add(os.path.normcase(matches[0]))
                        except (SafetySkip, FileNotFoundError, ValueError, OSError, KeyError) as error:
                            skipped(records, photo["id"], "RAW", matches[0], error)
                            raw_ready = None
                try:
                    no_mandatory = trial_jpeg_write(
                        tool, jpg, photo["description"], photo["fingerprint"], jpg_ready,
                        writable, recovery, check_state,
                    )
                except SafetySkip as error:
                    skipped(records, photo["id"], "JPG", photo["id"], error)
                    if raw_ready:
                        skipped(records, photo["id"], "RAW", raw.name, "Paired JPEG trial was unsafe")
                    save_json(journal_path, journal)
                    continue
                try:
                    jpg_after = write_file(tool, jpg, "JPG", photo["description"], photo["fingerprint"],
                                           jpg_ready, recovery, records, journal_path, journal, check_state,
                                           no_mandatory=no_mandatory)
                except WriteRefused:
                    if raw_ready:
                        skipped(records, photo["id"], "RAW", raw.name, "ExifTool refused the paired JPEG")
                    save_json(journal_path, journal)
                    continue
                current_photos[photo["id"]]["fingerprint"] = jpg_after
                if raw_ready:
                    if not unique_pair(photo_root, raw_root, jpg, raw.name):
                        skipped(records, photo["id"], "RAW", raw.name, "RAW pairing changed during the write")
                    else:
                        try:
                            raw_after = write_file(tool, raw, "RAW", photo["description"], candidates[0]["fingerprint"],
                                                   raw_ready, recovery, records, journal_path, journal, check_state)
                            current_photos[photo["id"]]["rawCandidates"][0]["fingerprint"] = raw_after
                        except WriteRefused:
                            pass
                save_json(journal_path, journal)
            check_state()
            journal["status"] = "completed"
            journal["completedAt"] = now()
            journal.pop("currentPhoto", None)
            save_json(journal_path, journal)
            request["status"] = "completed"
            request["result"] = result_for(records, journal_path)
            save_json(state_path, state)
            return request["result"]
        except Exception as error:
            journal["status"] = "stopped"
            journal["error"] = f"{type(error).__name__}: {error}"
            journal["stoppedAt"] = now()
            save_json(journal_path, journal)
            if revision(state_path) == expected_state_revision:
                request["status"] = "stopped"
                request["result"] = result_for(records, journal_path, journal["error"])
                save_json(state_path, state)
            raise


def main():
    parser = argparse.ArgumentParser(description="Write exactly one approved photo metadata request")
    parser.add_argument("--state", required=True)
    parser.add_argument("--request-id", required=True)
    parser.add_argument("--exiftool", required=True)
    args = parser.parse_args()
    result = run(args.state, args.request_id, exiftool_path(args.exiftool))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
