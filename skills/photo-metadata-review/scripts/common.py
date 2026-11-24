import contextlib
import hashlib
import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path


RAW_EXTENSIONS = {
    ".arq", ".arw", ".cr2", ".cr3", ".dng", ".erf", ".fff", ".iiq", ".kdc",
    ".mef", ".mos", ".mrw", ".nef", ".nrw", ".orf", ".pef", ".raf", ".raw",
    ".rw2", ".rwl", ".sr2", ".srw",
}


def now():
    return datetime.now(timezone.utc).isoformat()


def valid_name(value):
    return (
        isinstance(value, str)
        and value not in ("", ".", "..")
        and "/" not in value
        and "\\" not in value
        and ":" not in value
        and not any(char in value for char in "\r\n\0")
    )


def safe_child(directory, name):
    if not valid_name(name):
        raise ValueError(f"Invalid file name: {name!r}")
    path = directory / name
    if path.is_symlink() or not path.is_file() or path.resolve().parent != directory:
        raise ValueError(f"Not a regular file directly in the approved directory: {name!r}")
    return path


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(4 * 1024 * 1024):
            result.update(chunk)
    return result.hexdigest()


def fingerprint(path):
    before = path.stat()
    if before.st_nlink != 1:
        raise ValueError(f"Refusing a multiply linked file: {path.name}")
    sha = digest(path)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino) != (
        after.st_size, after.st_mtime_ns, after.st_dev, after.st_ino
    ):
        raise RuntimeError(f"File changed while being read: {path.name}")
    return {
        "size": after.st_size,
        "mtimeNs": str(after.st_mtime_ns),
        "device": str(after.st_dev),
        "inode": str(after.st_ino),
        "sha256": sha,
    }


def revision(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path):
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


def save_json(path, value):
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as out:
            json.dump(value, out, ensure_ascii=False, indent=2)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


@contextlib.contextmanager
def state_lock(path):
    directory = Path(str(path) + ".lock")
    token = uuid.uuid4().hex
    directory.mkdir(mode=0o700)
    owner = directory / "owner"
    try:
        owner.write_text(token, encoding="utf-8")
        yield
    finally:
        if owner.is_file() and owner.read_text(encoding="utf-8") == token:
            owner.unlink()
            directory.rmdir()


def exiftool_path(value):
    candidate = shutil.which(value)
    if candidate is None:
        raise FileNotFoundError(f"ExifTool not found: {value}")
    return str(Path(candidate).resolve(strict=True))


def exiftool(executable, arguments):
    arguments = ["-charset", "filename=UTF8", "-charset", "UTF8", *map(str, arguments)]
    if any(any(char in arg for char in "\r\n\0") for arg in arguments):
        raise ValueError("An ExifTool argument contains a newline or NUL")
    result = subprocess.run(
        [executable, "-config", "", "-@", "-"],
        input=("\n".join(arguments) + "\n").encode("utf-8"),
        capture_output=True,
        check=False,
    )
    stderr = result.stderr.decode("utf-8", "replace").strip()
    if result.returncode or stderr:
        raise RuntimeError(f"ExifTool exit {result.returncode}: {stderr}")
    return result.stdout.decode("utf-8", "strict")


def capture_date(entry):
    for key in ("ExifIFD:DateTimeOriginal", "XMP-exif:DateTimeOriginal", "ExifIFD:CreateDate"):
        value = entry.get(key)
        if isinstance(value, str) and len(value) >= 19:
            return value[:19]
    return None


def metadata_entries(executable, paths, tags):
    if not paths:
        return []
    output = exiftool(executable, ["-q", "-json", "-G1", "-a", "-n", *tags, *paths])
    entries = json.loads(output)
    if len(entries) != len(paths):
        raise RuntimeError("ExifTool did not return metadata for every requested file")
    for path, entry in zip(paths, entries):
        reported = os.path.normcase(os.path.normpath(entry.get("SourceFile", "")))
        expected = os.path.normcase(os.path.normpath(str(path)))
        if reported != expected or entry.get("ExifTool:Error"):
            raise RuntimeError(f"ExifTool returned an error or a different file for {path.name}")
    return entries
