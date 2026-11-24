import argparse
import ctypes
import hashlib
import json
import os
import re
import shutil
import sys
import uuid
from pathlib import Path

import numpy
import rawpy
import tifffile
from PIL import Image

from common import (
    RAW_EXTENSIONS, capture_date, digest, exiftool, exiftool_path, fingerprint,
    load_json, now, revision, safe_child, save_json, state_lock, valid_name,
)


IGNORED_METADATA = {
    "SourceFile", "IFD0:ImageDescription", "XMP-dc:Description", "XMP-x:XMPToolkit",
    "IFD0:PreviewImageStart", "IFD0:TileOffsets", "IFD1:ThumbnailOffset",
    "IFD2:JpgFromRawStart", "SR2:SR2SubIFDLength", "SR2:SR2SubIFDOffset",
    "Sony:HiddenDataOffset", "SubIFD:StripOffsets", "SubIFD:TileOffsets",
}


class SafetySkip(Exception):
    pass


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
    return entry


def validation(tool, path):
    return sorted(exiftool(tool, ["-a", "-s3", "-validate", "-warning", "-error", path]).splitlines())


def decoded_hash(path, kind, before):
    digest_value = hashlib.sha256()
    if kind == "JPG":
        with Image.open(path) as image:
            if image.format != "JPEG":
                raise SafetySkip(f"Not a JPEG: {path.name}")
            image.load()
            digest_value.update(f"{image.mode}:{image.size}".encode("ascii"))
            digest_value.update(image.tobytes())
        return digest_value.hexdigest()
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


def compare_metadata(before, after):
    changed = sorted(
        key for key in before.keys() | after.keys()
        if key not in IGNORED_METADATA and not key.startswith("System:")
        and before.get(key) != after.get(key)
    )
    if changed:
        raise RuntimeError(f"Unexpected metadata changes: {', '.join(changed)}")


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
            Path(name).suffix.lower() not in (".jpg", ".jpeg")
            or not isinstance(text, str) or not text.strip() or len(text) > 4000
            or any(char in text for char in "\r\n\0")
            or not isinstance(photo.get("fingerprint"), dict)
            or not isinstance(photo.get("rawMatches"), list)
            or not isinstance(photo.get("rawCandidates"), list)
        ):
            raise ValueError(f"Invalid approved record: {name}")
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
    expected = "JPEG" if kind == "JPG" else extension
    if before.get("File:FileType") != expected:
        raise SafetySkip(f"File content does not match the extension: {path.name}")
    decoded = decoded_hash(path, kind, before)
    warnings = validation(tool, path)
    attributes = extra_data(path)
    check_source(path, baseline)
    return before, decoded, warnings, attributes


def write_file(tool, source, kind, text, baseline, preflight, recovery, records, journal_path, journal, check_state):
    before, decoded_before, warnings_before, attributes_before = preflight
    backup = recovery / f"{uuid.uuid4().hex}-{source.name}"
    record = {
        "photo": journal["currentPhoto"], "kind": kind, "name": source.name,
        "status": "backing_up", "recoveryCopy": str(backup),
        "sha256Before": baseline["sha256"],
    }
    records.append(record)
    save_json(journal_path, journal)
    copy_original(source, backup)
    if digest(backup) != baseline["sha256"] or extra_data(backup) != attributes_before:
        raise RuntimeError(f"Recovery-copy verification failed: {source.name}")
    check_source(source, baseline)
    check_state()
    record["status"] = "writing"
    save_json(journal_path, journal)
    output = exiftool(tool, [
        "-overwrite_original_in_place",
        f"-IFD0:ImageDescription={text}",
        f"-XMP-dc:Description-x-default={text}",
        source,
    ])
    record["status"] = "written_unverified"
    save_json(journal_path, journal)
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
    compare_metadata(before, after)
    if validation(tool, source) != warnings_before:
        raise RuntimeError(f"ExifTool validation changed: {source.name}")
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
        "verifiedAt": now(),
    })
    save_json(journal_path, journal)
    backup.unlink()
    record["recoveryCopyRemoved"] = True
    save_json(journal_path, journal)
    return after_fingerprint


def result_for(records, journal_path, error=None):
    result = {
        "verifiedJpg": sum(r["status"] == "verified" and r["kind"] == "JPG" for r in records),
        "verifiedRaw": sum(r["status"] == "verified" and r["kind"] == "RAW" for r in records),
        "skippedJpg": sum(r["status"] == "skipped" and r["kind"] == "JPG" for r in records),
        "skippedRaw": sum(r["status"] == "skipped" and r["kind"] == "RAW" for r in records),
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
                jpg_after = write_file(tool, jpg, "JPG", photo["description"], photo["fingerprint"],
                                       jpg_ready, recovery, records, journal_path, journal, check_state)
                current_photos[photo["id"]]["fingerprint"] = jpg_after
                if raw_ready:
                    if not unique_pair(photo_root, raw_root, jpg, raw.name):
                        skipped(records, photo["id"], "RAW", raw.name, "RAW pairing changed during the write")
                    else:
                        raw_after = write_file(tool, raw, "RAW", photo["description"], candidates[0]["fingerprint"],
                                               raw_ready, recovery, records, journal_path, journal, check_state)
                        current_photos[photo["id"]]["rawCandidates"][0]["fingerprint"] = raw_after
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
