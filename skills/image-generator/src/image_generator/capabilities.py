"""Document-backed family profiles joined to live provider/name/version records."""

from __future__ import annotations

import re
import math
from dataclasses import asdict, dataclass

from .config import ChoiceRequired, size

OPENAI_DOC = "https://learn.microsoft.com/azure/foundry/openai/how-to/dall-e"
MAI_DOC = "https://learn.microsoft.com/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image"
CHECKED = "2026-10-14"


@dataclass(frozen=True)
class Capability:
    adapter: str
    sizes: tuple[str, ...] = ()
    min_edge: int = 1
    max_edge: int = 3840
    min_pixels: int = 1
    max_pixels: int = 8294400
    alignment: int = 1
    max_aspect: float = 3
    edit: bool = True
    max_references: int = 16
    qualities: tuple[str, ...] = ("low", "medium", "high")
    detail: str = "unknown"
    realism: str = "unknown"
    cost: str = "unknown"
    legacy: bool = False
    native_edit_size: bool = True
    evidence: str = OPENAI_DOC
    checked: str = CHECKED
    caveat: str = ""

    def describe(self) -> dict:
        return asdict(self)

    def validate(
        self, requested: str, quality: str, references: int, verify_edit=False
    ):
        w, h = size(requested)
        valid = (
            (not self.sizes or requested in self.sizes)
            and self.min_edge <= min(w, h) <= max(w, h) <= self.max_edge
            and self.min_pixels <= w * h <= self.max_pixels
            and w % self.alignment == h % self.alignment == 0
            and max(w, h) / min(w, h) <= self.max_aspect
        )
        if not valid:
            raise ChoiceRequired(
                f"Native {requested} is unsupported. Choose another model or explicitly change "
                "the brief's dimensions; this tool never clamps, snaps, crops or scales."
            )
        if quality not in self.qualities:
            raise ChoiceRequired(
                f"Quality {quality!r} unsupported; explicitly choose {self.qualities}."
            )
        if references and (not self.edit or references > self.max_references):
            raise ChoiceRequired(
                f"Reference edits unsupported, or more than {self.max_references} inputs."
            )
        if references and not self.native_edit_size and not verify_edit:
            raise ChoiceRequired(
                "MAI supports edits, but its documented edit API has no width/height fields. "
                "Choose an exact-size edit model, or explicitly approve verify_mai_edit_size: true "
                "(paid edit may fail dimension verification; original bytes are retained)."
            )


def profile(provider: str, model: str, version: str, overrides=()) -> Capability | None:
    for item in overrides:
        if not isinstance(item, dict) or set(item) != {
            "provider",
            "model",
            "version",
            "capability",
        }:
            raise ChoiceRequired(
                "Each capability_profiles entry requires provider, model, version, capability."
            )
        if (item["provider"], item["model"], str(item["version"])) == (
            provider,
            model,
            version,
        ):
            raw = item["capability"]
            explicit = {
                "adapter",
                "evidence",
                "checked",
                "edit",
                "max_references",
                "qualities",
                "native_edit_size",
            }
            if not isinstance(raw, dict) or not explicit <= set(raw):
                raise ChoiceRequired(
                    "A profile requires explicit adapter, official evidence/check date, "
                    "edit/reference/quality support and native_edit_size."
                )
            if not isinstance(raw["evidence"], str) or not raw["evidence"].startswith(
                "https://learn.microsoft.com/"
            ):
                raise ChoiceRequired(
                    "Capability evidence must be an official Microsoft Learn URL."
                )
            if not isinstance(raw["checked"], str) or not re.fullmatch(
                r"\d{4}-\d{2}-\d{2}", raw["checked"]
            ):
                raise ChoiceRequired("Capability checked date must be YYYY-MM-DD.")
            if not (
                raw.get("sizes")
                or {
                    "min_edge",
                    "max_edge",
                    "min_pixels",
                    "max_pixels",
                    "alignment",
                    "max_aspect",
                }
                <= set(raw)
            ):
                raise ChoiceRequired(
                    "Unknown models require explicit, documented dimension limits."
                )
            try:
                cap = Capability(**raw)
            except TypeError as exc:
                raise ChoiceRequired(f"Invalid capability profile: {exc}") from exc
            integers = (
                cap.min_edge,
                cap.max_edge,
                cap.min_pixels,
                cap.max_pixels,
                cap.alignment,
            )
            if (
                cap.adapter not in {"openai", "mai"}
                or any(type(value) is not int or value < 1 for value in integers)
                or cap.max_pixels < cap.min_pixels
                or cap.max_edge < cap.min_edge
                or type(cap.max_aspect) not in (int, float)
                or not math.isfinite(cap.max_aspect)
                or cap.max_aspect < 1
            ):
                raise ChoiceRequired("Invalid adapter or dimension limits.")
            if (
                type(cap.edit) is not bool
                or type(cap.native_edit_size) is not bool
                or type(cap.legacy) is not bool
                or type(cap.max_references) is not int
                or not 0 <= cap.max_references <= (5 if cap.adapter == "mai" else 16)
                or not isinstance(cap.qualities, (tuple, list))
                or not cap.qualities
                or any(
                    not isinstance(value, str) or not value for value in cap.qualities
                )
                or not isinstance(cap.sizes, (tuple, list))
            ):
                raise ChoiceRequired(
                    "Invalid explicit edit/reference/quality capability."
                )
            for value in cap.sizes:
                size(value)
            if cap.adapter == "mai" and (
                cap.native_edit_size
                or cap.qualities != ("standard",)
                and cap.qualities != ["standard"]
            ):
                raise ChoiceRequired(
                    "MAI adapter has no documented edit dimensions or quality control; "
                    "set native_edit_size: false and qualities: [standard]."
                )
            return cap
    if provider == "OpenAI":
        if model in {"gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare"}:
            newer = model.startswith("gpt-image-2.5")
            return Capability(
                adapter="openai",
                detail="high",
                realism="high",
                min_pixels=655360,
                alignment=16,
                qualities=("low", "medium", "high", "xhigh", "max", "auto")
                if newer
                else ("low", "medium", "high"),
                cost="speed/cost-optimized"
                if model.endswith("flare")
                else "higher-fidelity",
                caveat="Above 2560x1440 is experimental." if newer else "",
            )
        if model in {"gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"}:
            return Capability(
                adapter="openai",
                detail="general" if model.endswith("mini") else "high",
                realism="general/creative" if model.endswith("mini") else "high",
                sizes=("1024x1024", "1024x1536", "1536x1024"),
                max_edge=1536,
                max_pixels=1572864,
                legacy=True,
                cost="cost-efficient" if model.endswith("mini") else "higher-fidelity",
                caveat="No dedicated face preservation."
                if model.endswith("mini")
                else "",
            )
    if provider == "Microsoft":
        if model in {
            "MAI-Image-2.6",
            "MAI-Image-2.6-Flash",
            "MAI-Image-2.5",
            "MAI-Image-2.5-Pro",
            "MAI-Image-2.5-Flash",
        }:
            return Capability(
                adapter="mai",
                min_edge=768,
                max_edge=3072,
                max_pixels=2359296 if model.startswith("MAI-Image-2.6") else 1048576,
                max_aspect=4,
                max_references=5,
                qualities=("standard",),
                native_edit_size=False,
                evidence=MAI_DOC,
                cost="lower-cost" if model.endswith("Flash") else "higher-fidelity",
                detail="highest" if model.endswith("Pro") else "high",
                realism="high",
                caveat="Preview; no production SLA. Edit dimensions are not controllable.",
            )
    return None
