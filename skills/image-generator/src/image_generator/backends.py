"""Documented image API adapters; request transport and tokens are injectable."""

from __future__ import annotations

import base64
import io
import json
import math
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import httpx
from PIL import Image

from .config import ChoiceRequired
from .discovery import Candidate, endpoint


class GenerationError(RuntimeError):
    pass


def token_provider(settings: dict, *, subscription=None, tenant_id=None):
    # Construct only after paid inference was explicitly approved and preflight passed.
    from azure.identity import (
        AzureCliCredential,
        ManagedIdentityCredential,
        WorkloadIdentityCredential,
    )

    kind = settings.get("credential", "cli")
    if kind == "cli":
        credential = AzureCliCredential(
            subscription=subscription, tenant_id=tenant_id or ""
        )
    else:
        credential = {
            "managed-identity": ManagedIdentityCredential,
            "workload-identity": WorkloadIdentityCredential,
        }[kind]()
    return (
        credential,
        lambda: (
            credential.get_token("https://cognitiveservices.azure.com/.default").token
        ),
    )


def image_info(data: bytes) -> dict:
    try:
        with Image.open(io.BytesIO(data)) as image:
            info = {
                "width": image.width,
                "height": image.height,
                "format": image.format,
            }
            image.verify()
    except Exception as exc:
        raise GenerationError(f"Invalid image bytes: {type(exc).__name__}") from exc
    return info


def delay(value: str | None, attempt: int) -> float:
    if value:
        try:
            seconds = float(value)
        except ValueError:
            try:
                seconds = (
                    parsedate_to_datetime(value) - datetime.now(timezone.utc)
                ).total_seconds()
            except (ValueError, TypeError):
                seconds = 2**attempt
    else:
        seconds = 2**attempt
    return max(0, min(seconds, 60)) if math.isfinite(seconds) else 60


class ImageAPI:
    def __init__(
        self, client: httpx.Client, token, *, attempts=3, sleep=time.sleep, notify=None
    ):
        if type(attempts) is not int or not 1 <= attempts <= 5:
            raise ChoiceRequired("Request attempts must be between 1 and 5.")
        self.client, self.token = client, token
        self.attempts, self.sleep = attempts, sleep
        self.notify = notify or (lambda event: None)

    def post(
        self, url: str, *, json_body=None, form=None, files=None
    ) -> tuple[dict, dict]:
        for attempt in range(1, self.attempts + 1):
            try:
                bearer = self.token()
            except Exception as exc:
                raise GenerationError(
                    "Entra token acquisition failed. Check the explicitly chosen credential's "
                    "sign-in/workload identity configuration and Cognitive Services User RBAC."
                ) from exc
            try:
                response = self.client.post(
                    url,
                    headers={"Authorization": f"Bearer {bearer}"},
                    json=json_body,
                    data=form,
                    files=files,
                    timeout=300,
                )
            except httpx.TransportError as exc:
                self.notify(
                    {"attempt": attempt, "error": type(exc).__name__, "retry": False}
                )
                raise GenerationError(
                    "Transport failure; delivery/charges may be uncertain. Not replayed automatically. "
                    "Check the service before explicitly rerunning."
                ) from exc
            if response.status_code >= 400:
                message = response.text[:1000].replace(bearer, "[redacted]")
                event = {
                    "attempt": attempt,
                    "status": response.status_code,
                    "error": message,
                    "request_id": response.headers.get("x-request-id"),
                    "retry": response.status_code in {429, 503}
                    and attempt < self.attempts,
                }
                self.notify(event)
                if event["retry"]:
                    wait = delay(response.headers.get("Retry-After"), attempt)
                    self.notify({"attempt": attempt, "wait_seconds": wait})
                    self.sleep(wait)
                    continue
                raise GenerationError(
                    f"HTTP {response.status_code}: {message}. "
                    "401/403: check Entra/RBAC; 404: check deployment/API; "
                    "400: check capabilities/content policy; 429/503: wait and explicitly rerun."
                )
            if response.status_code not in (200, 201):
                raise GenerationError(
                    f"Unexpected HTTP {response.status_code}; redirects are never followed."
                )
            try:
                body = response.json()
            except ValueError as exc:
                raise GenerationError(
                    "API returned non-JSON success; not retried."
                ) from exc
            if not isinstance(body, dict) or body.get("error"):
                raise GenerationError(
                    f"API error: {str(body.get('error') if isinstance(body, dict) else body)[:1000]}"
                )
            return body, {
                "attempts": attempt,
                "request_id": response.headers.get("x-request-id"),
                "created": body.get("created"),
                "usage": body.get("usage"),
                "returned_model": body.get("model"),
                "returned_version": body.get("model_version"),
            }
        raise AssertionError("unreachable")

    def generate(
        self,
        candidate: Candidate,
        prompt: str,
        requested: str,
        quality: str,
        references: list[dict],
        *,
        verify_mai_edit_size=False,
    ) -> tuple[bytes, dict]:
        cap = candidate.capability
        if cap is None:
            raise ChoiceRequired("Cannot invoke an unknown image family.")
        cap.validate(requested, quality, len(references), verify_mai_edit_size)
        origin = endpoint(candidate.endpoint)
        operation = "edits" if references else "generations"
        files = None
        if references:
            files = []
            for ref in references:
                info = image_info(ref["bytes"])
                if info["format"] not in {"PNG", "JPEG"}:
                    raise ChoiceRequired(
                        "References must be PNG or JPEG; conversion requires explicit authoring."
                    )
                if len(ref["bytes"]) >= 50 * 1024 * 1024:
                    raise ChoiceRequired(
                        "Reference is 50 MB or larger; reduce it explicitly, never silently."
                    )
                mime = "image/png" if info["format"] == "PNG" else "image/jpeg"
                field = "image" if cap.adapter == "mai" else "image[]"
                files.append((field, (ref["name"], ref["bytes"], mime)))
        if cap.adapter == "openai":
            if not candidate.api_version:
                raise ChoiceRequired(
                    "Explicit azure.image_api_version is required for OpenAI image inference."
                )
            if candidate.api_version == "v1":
                url = f"{origin}/openai/v1/images/{operation}"
            else:
                url = (
                    f"{origin}/openai/deployments/{quote(candidate.deployment, safe='')}"
                    f"/images/{operation}?api-version={quote(candidate.api_version, safe='')}"
                )
            body = {
                "model": candidate.deployment,
                "prompt": prompt,
                "size": requested,
                "quality": quality,
                "n": 1,
                "output_format": "png",
            }
        elif cap.adapter == "mai":
            if ".services.ai.azure.com" not in origin:
                raise ChoiceRequired(
                    "MAI inference requires an authorized services.ai.azure.com origin."
                )
            url = f"{origin}/mai/v1/images/{operation}"
            body = {"model": candidate.deployment, "prompt": prompt}
            if not references:
                width, height = map(int, requested.split("x"))
                body.update(width=width, height=height)
            # MAI edit width/height and quality are not documented parameters.
        else:
            raise ChoiceRequired(f"Unsupported documented API adapter: {cap.adapter}")
        response, meta = self.post(
            url,
            json_body=body if not references else None,
            form={key: str(value) for key, value in body.items()}
            if references
            else None,
            files=files,
        )
        results = response.get("data")
        if (
            not isinstance(results, list)
            or len(results) != 1
            or not isinstance(results[0], dict)
        ):
            raise GenerationError(
                "Expected exactly one image result; refusing an unknown response shape."
            )
        encoded = results[0].get("b64_json")
        if not isinstance(encoded, str):
            raise GenerationError(
                "Expected b64_json; URL downloads and redirects are not supported."
            )
        try:
            raw = base64.b64decode(encoded, validate=True)
        except ValueError as exc:
            raise GenerationError("Invalid base64 image result.") from exc
        meta.update(
            {"api_url": url, "revised_prompt": results[0].get("revised_prompt")}
        )
        return raw, meta

    def compile(
        self, candidate: Candidate, image: dict, brief: dict, count: int
    ) -> list[str]:
        url = f"{endpoint(candidate.endpoint)}/openai/v1/chat/completions"
        payload = {
            "model": candidate.deployment,
            "messages": [
                {
                    "role": "system",
                    "content": "Author complete image prompts. Return only a JSON array "
                    f"of exactly {count} nonempty strings. Preserve every shared requirement. "
                    "Do not invent a reference's appearance; reference files will be sent to the image model.",
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "common_requirements": brief["common_requirements"],
                            "description": image["description"],
                            "size": image.get("size", brief["size"]),
                            "preferences": brief.get("preferences", {}),
                        }
                    ),
                },
            ],
        }
        response, _ = self.post(url, json_body=payload)
        try:
            content = response["choices"][0]["message"]["content"]
            prompts = json.loads(content)
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise GenerationError(
                "Prompt compiler must return a JSON array; no silent prompt fallback."
            ) from exc
        if (
            not isinstance(prompts, list)
            or len(prompts) != count
            or any(not isinstance(p, str) or not p.strip() for p in prompts)
        ):
            raise GenerationError(
                "Prompt compiler returned an incorrect count or incomplete prompts."
            )
        return prompts
