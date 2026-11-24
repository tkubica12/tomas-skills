import argparse
import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageOps

from common import (
    RAW_EXTENSIONS, capture_date, exiftool_path, fingerprint, load_json,
    metadata_entries, now, revision, safe_child, save_json, state_lock, valid_name,
)


def directory(value):
    result = Path(value).expanduser().resolve(strict=True)
    if not result.is_dir():
        raise ValueError(f"Not a directory: {result}")
    return result


def within(child, parent):
    return child == parent or parent in child.parents


def thumbnail(source, destination):
    with Image.open(source) as image:
        if image.format != "JPEG":
            raise ValueError(f"Not a JPEG: {source.name}")
        image.load()
        preview = ImageOps.exif_transpose(image)
        preview.thumbnail((640, 480))
        preview.convert("RGB").save(destination, "JPEG", quality=83, optimize=True)


def initialize(args):
    photos_root = directory(args.photos)
    raw_root = directory(args.raw) if args.raw else None
    target = Path(args.review).expanduser().resolve()
    if within(target, photos_root) or (raw_root and within(target, raw_root)):
        raise ValueError("Put the private review directory outside the photo and RAW directories")
    if target.exists():
        raise FileExistsError(f"Review directory already exists: {target}")
    tool = exiftool_path(args.exiftool)
    if getattr(args, "files", None):
        names = args.files
        if len({os.path.normcase(name) for name in names}) != len(names):
            raise ValueError("Selected JPEG names must be unique")
        jpgs = [safe_child(photos_root, name) for name in names]
        if any(path.suffix.lower() not in (".jpg", ".jpeg") for path in jpgs):
            raise ValueError("Selected files must be JPG/JPEG children of the photo directory")
    else:
        jpgs = [p for p in photos_root.iterdir() if p.suffix.lower() in (".jpg", ".jpeg")]
    jpgs.sort(key=lambda p: p.name.casefold())
    if not jpgs:
        raise ValueError("No direct JPG/JPEG children in the selected directory")
    for photo in jpgs:
        safe_child(photos_root, photo.name)
    stems = {os.path.normcase(photo.stem) for photo in jpgs}
    jpg_stems = {}
    for photo in photos_root.iterdir():
        if photo.suffix.lower() in (".jpg", ".jpeg"):
            key = os.path.normcase(photo.stem)
            jpg_stems[key] = jpg_stems.get(key, 0) + 1
    raw_by_stem = {}
    if raw_root:
        for item in raw_root.iterdir():
            if item.suffix.lower() in RAW_EXTENSIONS and os.path.normcase(item.stem) in stems:
                safe_child(raw_root, item.name)
                raw_by_stem.setdefault(os.path.normcase(item.stem), []).append(item)
    candidates = sorted(
        (item for group in raw_by_stem.values() for item in group), key=lambda p: p.name.casefold()
    )
    paths = jpgs + candidates
    entries = metadata_entries(
        tool, paths,
        ["-DateTimeOriginal", "-CreateDate", "-GPSLatitude", "-GPSLongitude", "-FileType"],
    )
    metadata = {str(path): entry for path, entry in zip(paths, entries)}
    baselines = {str(path): fingerprint(path) for path in paths}
    target.mkdir(mode=0o700, parents=True)
    thumbs = target / "thumbnails"
    thumbs.mkdir(mode=0o700)
    photos = []
    for path in jpgs:
        key = hashlib.sha256(path.name.encode("utf-8")).hexdigest()
        thumbnail(path, thumbs / f"{key}.jpg")
        if fingerprint(path) != baselines[str(path)]:
            raise RuntimeError(f"Photo changed while preparing the review: {path.name}")
        entry = metadata[str(path)]
        raw_items = sorted(raw_by_stem.get(os.path.normcase(path.stem), []), key=lambda p: p.name.casefold())
        photos.append({
            "id": path.name,
            "date": capture_date(entry),
            "gps": {
                "latitude": entry.get("Composite:GPSLatitude", entry.get("GPS:GPSLatitude")),
                "longitude": entry.get("Composite:GPSLongitude", entry.get("GPS:GPSLongitude")),
            },
            "description": "",
            "confidence": "unknown",
            "visuallyExamined": False,
            "evidence": [],
            "fingerprint": baselines[str(path)],
            "thumbnail": f"{key}.jpg",
            "rawMatches": [item.name for item in raw_items],
            "rawCandidates": [{
                "name": item.name,
                "date": capture_date(metadata[str(item)]),
                "format": metadata[str(item)].get("File:FileType"),
                "fingerprint": baselines[str(item)],
            } for item in raw_items],
            "ambiguousJpgStem": jpg_stems[os.path.normcase(path.stem)] != 1,
        })
    state = {
        "schemaVersion": 1,
        "createdAt": now(),
        "language": args.language,
        "photoDirectory": str(photos_root),
        "rawDirectory": str(raw_root) if raw_root else None,
        "photos": photos,
        "feedback": [],
        "writeRequest": None,
    }
    state_path = target / "state.json"
    save_json(state_path, state)
    save_json(target / "drafts.json", {})
    return {"state": str(state_path), "revision": revision(state_path), "photos": len(photos)}


def validate_proposal(proposal):
    if not isinstance(proposal, dict) or not valid_name(proposal.get("id")):
        raise ValueError("Every proposal must name an existing photo")
    text = proposal.get("description")
    if (
        not isinstance(text, str) or not text.strip() or len(text) > 4000
        or any(char in text for char in "\r\n\0")
    ):
        raise ValueError(f"Invalid description for {proposal['id']}")
    if proposal.get("confidence") not in ("high", "medium", "low", "unknown"):
        raise ValueError(f"Invalid confidence for {proposal['id']}")
    if not isinstance(proposal.get("visuallyExamined"), bool):
        raise ValueError(f"visuallyExamined must be a boolean for {proposal['id']}")
    evidence = proposal.get("evidence", [])
    if not isinstance(evidence, list) or len(evidence) > 30:
        raise ValueError(f"Invalid evidence for {proposal['id']}")
    for item in evidence:
        if not isinstance(item, dict) or set(item) - {"label", "url"}:
            raise ValueError(f"Invalid evidence item for {proposal['id']}")
        if not isinstance(item.get("label"), str) or len(item["label"]) > 500:
            raise ValueError(f"Invalid evidence label for {proposal['id']}")
        if "url" in item and (
            not isinstance(item["url"], str) or not item["url"].startswith(("https://", "http://"))
            or len(item["url"]) > 2000
        ):
            raise ValueError(f"Invalid evidence URL for {proposal['id']}")


def apply(args):
    path = Path(args.state).expanduser().resolve(strict=True)
    proposals = load_json(Path(args.proposals).expanduser().resolve(strict=True))
    if not isinstance(proposals, list) or not proposals:
        raise ValueError("Proposals must be a nonempty JSON array")
    for proposal in proposals:
        validate_proposal(proposal)
    ids = [item["id"] for item in proposals]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate proposal IDs")
    with state_lock(path):
        if revision(path) != args.revision:
            raise RuntimeError("Review changed; fetch its revision before applying proposals")
        state = load_json(path)
        if state.get("schemaVersion") != 1:
            raise ValueError("Unsupported review state version")
        if (state.get("writeRequest") or {}).get("status") in ("pending", "writing", "stopped"):
            raise RuntimeError("An approved write is pending, running, or requires recovery")
        photos = {item["id"]: item for item in state["photos"]}
        if any(identifier not in photos for identifier in ids):
            raise ValueError("A proposal names a photo outside the review")
        if args.feedback_id:
            matches = [f for f in state["feedback"] if f["id"] == args.feedback_id and f["status"] == "pending"]
            if len(matches) != 1 or not {e["id"] for e in matches[0]["entries"]}.issubset(ids):
                raise ValueError("The feedback is not pending or its photos are missing from the proposals")
            matches[0]["status"] = "processed"
            matches[0]["processedAt"] = now()
        for item in proposals:
            photos[item["id"]].update({
                "description": item["description"].strip(),
                "confidence": item["confidence"],
                "visuallyExamined": item["visuallyExamined"],
                "evidence": item.get("evidence", []),
            })
        save_json(path, state)
    return {"revision": revision(path), "applied": len(proposals), "feedbackId": args.feedback_id}


def status(args):
    path = Path(args.state).expanduser().resolve(strict=True)
    state = load_json(path)
    return {
        "revision": revision(path),
        "photos": len(state["photos"]),
        "pendingFeedback": [f["id"] for f in state["feedback"] if f["status"] == "pending"],
        "writeRequest": state.get("writeRequest"),
    }


def main():
    parser = argparse.ArgumentParser(description="Prepare and update a private photo review")
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init")
    init.add_argument("--photos", required=True)
    init.add_argument("--raw")
    init.add_argument("--files", nargs="+", help="Exact JPG/JPEG names directly inside --photos")
    init.add_argument("--review", required=True)
    init.add_argument("--exiftool", required=True)
    init.add_argument("--language", choices=("cs", "en"), default="en")
    init.set_defaults(run=initialize)
    apply_command = commands.add_parser("apply")
    apply_command.add_argument("--state", required=True)
    apply_command.add_argument("--revision", required=True)
    apply_command.add_argument("--proposals", required=True)
    apply_command.add_argument("--feedback-id")
    apply_command.set_defaults(run=apply)
    stat = commands.add_parser("status")
    stat.add_argument("--state", required=True)
    stat.set_defaults(run=status)
    args = parser.parse_args()
    print(json.dumps(args.run(args), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
