"""Sequential, bounded jobs with content-addressed cache and immutable originals."""

from __future__ import annotations

import hashlib
import json
import sys
import uuid
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

from . import __version__
from .backends import GenerationError, ImageAPI, image_info
from .config import ChoiceRequired
from .discovery import Candidate


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(data) -> bytes:
    return json.dumps(
        data, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode()


def identity(data) -> str:
    return digest(canonical(data))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.with_name(path.name + "." + uuid.uuid4().hex + ".pending")
    try:
        staging.write_bytes(canonical(data) + b"\n")
        staging.replace(path)
    finally:
        staging.unlink(missing_ok=True)


def environment() -> dict:
    result = {"python": sys.version.split()[0], "skill": __version__}
    for package in ("azure-identity", "httpx", "pillow", "pyyaml"):
        try:
            result[package] = version(package)
        except PackageNotFoundError:
            result[package] = "missing"
    return result


def offline_plan(brief: dict) -> dict:
    count = (
        sum(
            len(item["prompts"])
            if item.get("prompts")
            else brief["prompt_compiler"]["count"]
            for item in brief["images"]
        )
        * brief["instances_per_prompt"]
    )
    compiler_requests = sum(not item.get("prompts") for item in brief["images"])
    return {
        "mode": "offline; no discovery, identity or inference",
        "planned_calls": {
            "image_requests": count,
            "max_image_attempts": count * brief["max_attempts"],
            "compiler_requests": compiler_requests,
            "max_compiler_attempts": compiler_requests * brief["max_attempts"],
        },
        "requirements": {
            "size": brief["size"],
            "quality": brief["quality"],
            "preferences": brief.get("preferences", {}),
        },
        "images": [
            {
                "name": item["name"],
                "size": item.get("size", brief["size"]),
                "reference_count": len(item.get("references", [])),
                "prompts": item.get("prompts", "explicit optional compiler"),
                "instances_per_prompt": brief["instances_per_prompt"],
            }
            for item in brief["images"]
        ],
        "azure": brief.get("azure", {}),
        "environment": environment(),
        "next": "Read-only discover; resolve choices; approve inference count, retry ceiling and costs.",
    }


def references(image: dict) -> list[dict]:
    result = []
    for filename in image.get("references", []):
        path = Path(filename)
        raw = path.read_bytes()
        info = image_info(raw)
        if info["format"] not in {"PNG", "JPEG"} or len(raw) >= 50 * 1024 * 1024:
            raise ChoiceRequired("Reference must be unmodified PNG/JPEG under 50 MB.")
        result.append({"name": path.name, "bytes": raw, "sha256": digest(raw), **info})
    return result


def cached(folder: Path, key: str, requested: str) -> dict | None:
    try:
        meta = json.loads((folder / "result.json").read_text(encoding="utf-8"))
        raw = (folder / "original.png").read_bytes()
        info = image_info(raw)
        if (
            meta["key"] == key
            and identity(meta["lineage"]) == key
            and meta["status"] == "generated"
            and digest(raw) == meta["image_sha256"]
            and info == meta["returned_image"]
            and info["format"] == "PNG"
            and f"{info['width']}x{info['height']}" == requested
        ):
            return meta
    except (OSError, ValueError, KeyError, GenerationError):
        return None
    return None


def compiler_candidate(
    report: dict, brief: dict, image_candidate: Candidate
) -> Candidate | None:
    compiler = brief.get("prompt_compiler")
    if compiler is None or all(item.get("prompts") for item in brief["images"]):
        return None
    matches = []
    for item in report["candidates"]:
        caps = item.catalog.get("capabilities", {})
        chat = str(caps.get("chatCompletion", "")).lower() == "true"
        if (
            item.resource_id == image_candidate.resource_id
            and item.deployment == compiler["deployment"]
            and item.state == "Succeeded"
            and item.version
            and chat
            and item.lifecycle.lower() in {"generallyavailable", "preview", "ga"}
        ):
            matches.append(item)
    if len(matches) != 1:
        raise ChoiceRequired(
            "Explicit prompt_compiler deployment must resolve to one catalog-confirmed "
            "chatCompletion-capable deployed model/version on the selected resource."
        )
    return matches[0]


def run(
    brief: dict, candidate: Candidate, api: ImageAPI, *, compiler=None, emit=print
) -> dict:
    output = Path(brief["output_dir"])
    run_id = (
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex
    )
    manifest = {
        "schema": 1,
        "run_id": run_id,
        "environment": environment(),
        "brief": brief,
        "planned_calls": offline_plan(brief)["planned_calls"],
        "selected_model": candidate.describe(),
        "compiler": compiler.describe() if compiler else None,
        "records": [],
        "events": [],
    }
    manifest_path = output / "runs" / f"{run_id}.json"
    original_notify = api.notify

    def notify(event):
        manifest["events"].append(event)
        write_json(manifest_path, manifest)
        emit(json.dumps(event))
        original_notify(event)

    # Read and validate all local inputs before any paid call or output creation.
    loaded_refs = {item["name"]: references(item) for item in brief["images"]}
    for item in brief["images"]:
        if candidate.capability is None:
            raise ChoiceRequired("No documented image capability.")
        candidate.capability.validate(
            item.get("size", brief["size"]),
            brief["quality"],
            len(loaded_refs[item["name"]]),
            brief.get("verify_mai_edit_size", False),
        )
    write_json(manifest_path, manifest)
    # The full brief, not merely an existing filename, participates in every cache identity.
    brief_identity = {key: value for key, value in brief.items() if key != "output_dir"}
    try:
        api.notify = notify
        for item in brief["images"]:
            refs = loaded_refs[item["name"]]
            refs_meta = [
                {key: value for key, value in ref.items() if key != "bytes"}
                for ref in refs
            ]
            for ref in refs:
                ref_path = (
                    output / "references" / f"{ref['sha256']}.{ref['format'].lower()}"
                )
                ref_path.parent.mkdir(parents=True, exist_ok=True)
                if not ref_path.exists():
                    with ref_path.open("xb") as stream:
                        stream.write(ref["bytes"])
                elif digest(ref_path.read_bytes()) != ref["sha256"]:
                    raise GenerationError(
                        "Content-addressed reference archive was modified."
                    )
            prompts = item.get("prompts")
            if prompts is None:
                if compiler is None:
                    raise ChoiceRequired(
                        "Missing explicitly configured and verified prompt compiler."
                    )
                compile_key = identity(
                    {
                        "brief": brief_identity,
                        "image": item,
                        "references": refs_meta,
                        "compiler": compiler.describe(),
                        "skill": __version__,
                    }
                )
                prompt_file = output / "prompts" / f"{compile_key}.json"
                try:
                    prompt_record = json.loads(prompt_file.read_text(encoding="utf-8"))
                    prompts = prompt_record["prompts"]
                    if (
                        prompt_record["key"] != compile_key
                        or identity(prompts) != prompt_record["sha256"]
                        or not isinstance(prompts, list)
                        or len(prompts) != brief["prompt_compiler"]["count"]
                        or any(not isinstance(p, str) or not p.strip() for p in prompts)
                    ):
                        prompts = None
                except (OSError, ValueError, KeyError):
                    prompts = None
                if prompts is None:
                    prompts = api.compile(
                        compiler, item, brief, brief["prompt_compiler"]["count"]
                    )
                    write_json(
                        prompt_file,
                        {
                            "key": compile_key,
                            "prompts": prompts,
                            "sha256": identity(prompts),
                        },
                    )
            requested = item.get("size", brief["size"])
            for variation, authored in enumerate(prompts, 1):
                prompt = brief["common_requirements"] + "\n\n" + authored
                for instance in range(1, brief["instances_per_prompt"] + 1):
                    lineage = {
                        "brief": brief_identity,
                        "image": item["name"],
                        "authored_prompt": authored,
                        "submitted_prompt": prompt,
                        "reference_contents": refs_meta,
                        "actual_model": candidate.describe(),
                        "dimensions": requested,
                        "quality": brief["quality"],
                        "variation": variation,
                        "instance": instance,
                        "compiler": compiler.describe() if compiler else None,
                        "skill": __version__,
                    }
                    key = identity(lineage)
                    cache_root = output / "images" / key
                    previous = None
                    if cache_root.exists():
                        for folder in sorted(cache_root.iterdir()):
                            if folder.is_dir():
                                previous = cached(folder, key, requested)
                                if previous:
                                    break
                    if previous:
                        manifest["records"].append({**previous, "status": "cache_hit"})
                        emit(
                            f"{item['name']} v{variation} i{instance}: verified cache hit"
                        )
                        write_json(manifest_path, manifest)
                        continue
                    folder = cache_root / uuid.uuid4().hex
                    folder.mkdir(parents=True)
                    record = {
                        "key": key,
                        "status": "pending",
                        "lineage": lineage,
                        "original": str((folder / "original.png").relative_to(output)),
                        "source_run": run_id,
                    }
                    # Journal before submission: a process interruption is not a reusable cache result.
                    manifest["records"].append(record)
                    write_json(manifest_path, manifest)
                    try:
                        raw, response = api.generate(
                            candidate,
                            prompt,
                            requested,
                            brief["quality"],
                            refs,
                            verify_mai_edit_size=brief.get(
                                "verify_mai_edit_size", False
                            ),
                        )
                        record["response"] = response
                        record["image_sha256"] = digest(raw)
                        with (folder / "original.png").open("xb") as stream:
                            stream.write(raw)
                        info = image_info(raw)
                        record["returned_image"] = info
                        returned = f"{info['width']}x{info['height']}"
                        if info["format"] != "PNG" or returned != requested:
                            raise GenerationError(
                                f"Requested native PNG {requested}; service returned {info['format']} {returned}. "
                                "Original retained; not scaled and not cached as success."
                            )
                        if response.get("returned_model") not in (
                            None,
                            candidate.model,
                            candidate.deployment,
                        ):
                            raise GenerationError(
                                "Returned model identity disagrees with discovery; original retained."
                            )
                        if response.get("returned_version") not in (
                            None,
                            candidate.version,
                        ):
                            raise GenerationError(
                                "Returned model version changed; original retained; rediscover."
                            )
                        record["status"] = "generated"
                    except (GenerationError, ChoiceRequired) as exc:
                        record.update(status="failed", error=str(exc))
                    write_json(folder / "result.json", record)
                    write_json(manifest_path, manifest)
                    emit(
                        f"{item['name']} v{variation} i{instance}: {record['status']}"
                        + (f": {record['error']}" if "error" in record else "")
                    )
    except Exception as exc:
        manifest["fatal_error"] = str(exc)
        write_json(manifest_path, manifest)
        raise
    finally:
        api.notify = original_notify
    manifest["summary"] = {
        status: sum(record["status"] == status for record in manifest["records"])
        for status in ("generated", "cache_hit", "failed")
    }
    write_json(manifest_path, manifest)
    return {"manifest": str(manifest_path), **manifest["summary"]}
