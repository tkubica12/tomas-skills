"""Strict, local-only brief loading. No implicit environment or .env files."""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml


class ChoiceRequired(ValueError):
    """A concrete user choice is needed before inference."""


def size(value: str) -> tuple[int, int]:
    if not isinstance(value, str) or not re.fullmatch(r"[1-9]\d*x[1-9]\d*", value):
        raise ChoiceRequired(
            "Specify exact positive WIDTHxHEIGHT, not auto or an aspect ratio."
        )
    return tuple(map(int, value.split("x")))


def fields(data: dict, allowed: set[str], label: str) -> None:
    if not isinstance(data, dict):
        raise ChoiceRequired(f"{label} must be a mapping.")
    unknown = set(data) - allowed
    if unknown:
        raise ChoiceRequired(f"Unknown {label} fields: {', '.join(sorted(unknown))}")


def text(value, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ChoiceRequired(f"{label} must be nonempty text.")
    return value


def load(path: Path) -> dict:
    path = path.resolve()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    fields(
        data,
        {
            "common_requirements",
            "images",
            "size",
            "quality",
            "instances_per_prompt",
            "output_dir",
            "azure",
            "prompt_compiler",
            "preferences",
            "capability_profiles",
            "allow_legacy",
            "verify_mai_edit_size",
            "max_attempts",
        },
        "brief",
    )
    text(data.get("common_requirements"), "common_requirements")
    data.setdefault("size", "3840x2160")
    size(data["size"])
    data.setdefault("quality", "high")
    text(data["quality"], "quality")
    data.setdefault("instances_per_prompt", 1)
    data.setdefault("max_attempts", 3)
    for key, maximum in (("instances_per_prompt", 20), ("max_attempts", 5)):
        value = data[key]
        if type(value) is not int or not 1 <= value <= maximum:
            raise ChoiceRequired(f"{key} must be an integer from 1 through {maximum}.")
    for key in ("allow_legacy", "verify_mai_edit_size"):
        if key in data and type(data[key]) is not bool:
            raise ChoiceRequired(f"{key} must be true or false.")
    azure = data.setdefault("azure", {})
    fields(
        azure,
        {
            "subscription",
            "resource_id",
            "resource_group",
            "account",
            "endpoint",
            "deployment",
            "image_api_version",
            "credential",
        },
        "azure",
    )
    for key, value in azure.items():
        text(value, f"azure.{key}")
    if bool(azure.get("resource_group")) != bool(azure.get("account")):
        raise ChoiceRequired("Specify both azure.resource_group and azure.account.")
    if azure.get("credential", "cli") not in {
        "cli",
        "managed-identity",
        "workload-identity",
    }:
        raise ChoiceRequired(
            "azure.credential must be cli, managed-identity or workload-identity."
        )
    preferences = data.setdefault("preferences", {})
    fields(preferences, {"detail", "realism", "cost", "freshness"}, "preferences")
    for key, value in preferences.items():
        text(value, f"preferences.{key}")
    if "capability_profiles" in data and not isinstance(
        data["capability_profiles"], list
    ):
        raise ChoiceRequired(
            "capability_profiles must be a list of version-specific documented profiles."
        )
    compiler = data.get("prompt_compiler")
    if compiler is not None:
        fields(compiler, {"deployment", "count"}, "prompt_compiler")
        text(compiler.get("deployment"), "prompt_compiler.deployment")
        if type(compiler.get("count")) is not int or not 1 <= compiler["count"] <= 20:
            raise ChoiceRequired(
                "prompt_compiler.count must be an integer from 1 through 20."
            )
    images = data.get("images")
    if not isinstance(images, list) or not images:
        raise ChoiceRequired("images must be a nonempty list.")
    names = set()
    for image in images:
        fields(image, {"name", "description", "prompts", "size", "references"}, "image")
        name = text(image.get("name"), "image.name")
        if (
            not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}", name)
            or name.lower() in names
        ):
            raise ChoiceRequired(
                "Image names must be unique filesystem-safe slugs (1–80 characters)."
            )
        names.add(name.lower())
        text(image.get("description"), f"{name}.description")
        size(image.get("size", data["size"]))
        prompts = image.get("prompts")
        if prompts is None and compiler is None:
            raise ChoiceRequired(
                f"{name}: author complete prompts, or explicitly configure prompt_compiler."
            )
        if prompts is not None:
            if not isinstance(prompts, list) or not 1 <= len(prompts) <= 20:
                raise ChoiceRequired(
                    f"{name}.prompts must contain 1–20 complete prompts."
                )
            for prompt in prompts:
                text(prompt, f"{name}.prompt")
        refs = image.get("references", [])
        if not isinstance(refs, list):
            raise ChoiceRequired(
                f"{name}.references must be a list of local filenames."
            )
        image["references"] = []
        for ref in refs:
            resolved = (path.parent / text(ref, "reference path")).resolve()
            if not resolved.is_file():
                raise ChoiceRequired(f"Reference does not exist: {resolved}")
            image["references"].append(str(resolved))
    data["output_dir"] = str((path.parent / data.get("output_dir", "output")).resolve())
    # Reject non-JSON YAML types before any discovery or paid request.
    try:
        json.dumps(data, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ChoiceRequired(
            "Brief values must be JSON-compatible, with finite numbers."
        ) from exc
    return data
