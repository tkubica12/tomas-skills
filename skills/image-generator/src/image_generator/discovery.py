"""Read-only Azure CLI discovery. Deployment aliases never identify a backend."""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import asdict, dataclass
from urllib.parse import urlsplit

from .capabilities import Capability, profile
from .config import ChoiceRequired


def endpoint(value: str) -> str:
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.port not in (None, 443)
        or parsed.path not in ("", "/")
    ):
        raise ChoiceRequired(
            "Endpoint must be an HTTPS Azure resource origin (no credentials, path or query)."
        )
    host = parsed.hostname or ""
    if not any(
        host.endswith(suffix)
        for suffix in (
            ".openai.azure.com",
            ".services.ai.azure.com",
            ".cognitiveservices.azure.com",
        )
    ):
        raise ChoiceRequired(
            "Only Azure public-cloud AI resource endpoints are supported."
        )
    return value.rstrip("/").lower()


class AzureCLI:
    def __call__(self, *args):
        executable = shutil.which("az")
        if not executable:
            raise ChoiceRequired(
                "Install Azure CLI 2.60+; sign in explicitly with az login."
            )
        try:
            result = subprocess.run(
                [executable, *args, "--only-show-errors", "-o", "json"],
                text=True,
                capture_output=True,
                timeout=90,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ChoiceRequired(
                f"Azure read failed: {exc}. No resources were modified."
            ) from exc
        if result.returncode:
            raise ChoiceRequired(
                f"Azure read failed: {result.stderr.strip()[:1000]}. Check az login, "
                "subscription and management-plane Reader RBAC; discovery did not modify Azure."
            )
        try:
            return json.loads(result.stdout)
        except ValueError as exc:
            raise ChoiceRequired("Azure CLI returned invalid JSON.") from exc


@dataclass
class Candidate:
    resource_id: str
    account: str
    region: str
    endpoint: str
    deployment: str
    provider: str
    model: str
    version: str
    state: str
    lifecycle: str
    catalog: dict
    sku: dict
    capability: Capability | None
    api_version: str | None

    def describe(self):
        result = asdict(self)
        result["capability"] = self.capability.describe() if self.capability else None
        return result


def discover(config: dict, cli=None) -> dict:
    cli = cli or AzureCLI()
    settings = config.get("azure", {})
    resource_subscription = None
    if settings.get("resource_id"):
        pieces = settings["resource_id"].strip("/").split("/")
        if (
            len(pieces) != 8
            or pieces[0].lower() != "subscriptions"
            or pieces[2].lower() != "resourcegroups"
        ):
            raise ChoiceRequired(
                "azure.resource_id must be a full Cognitive Services account ARM resource ID."
            )
        if (
            pieces[4].lower() != "providers"
            or pieces[5].lower() != "microsoft.cognitiveservices"
        ):
            raise ChoiceRequired(
                "azure.resource_id must name a Microsoft.CognitiveServices account."
            )
        if pieces[6].lower() != "accounts":
            raise ChoiceRequired("Select an account, not a deployment resource ID.")
        resource_subscription = pieces[1]
        if (
            settings.get("subscription")
            and settings["subscription"].lower() != resource_subscription.lower()
        ):
            raise ChoiceRequired(
                "Explicit subscription and resource_id subscription disagree."
            )
    explicit_subscription = settings.get("subscription", resource_subscription)
    current = (
        cli("account", "show", "--subscription", explicit_subscription)
        if explicit_subscription
        else cli("account", "show")
    )
    subscription = explicit_subscription or current.get("id")
    if not subscription:
        raise ChoiceRequired(
            "Choose azure.subscription or sign in to an authorized current subscription."
        )
    args = ("--subscription", subscription)
    if settings.get("resource_id"):
        account = cli(
            "cognitiveservices",
            "account",
            "show",
            "--ids",
            settings["resource_id"],
            *args,
        )
        accounts = [account]
    elif settings.get("account"):
        account = cli(
            "cognitiveservices",
            "account",
            "show",
            "-n",
            settings["account"],
            "-g",
            settings["resource_group"],
            *args,
        )
        accounts = [account]
    else:
        accounts = cli("cognitiveservices", "account", "list", *args)
    candidates, available, blocked = [], [], []
    for account in accounts:
        if account.get("kind") not in {"OpenAI", "AIServices"}:
            continue
        if (
            settings.get("resource_id")
            and account["id"].lower() != settings["resource_id"].lower()
        ):
            raise ChoiceRequired(
                "Resource ID returned by Azure does not match the configured resource."
            )
        name, group = account["name"], account["resourceGroup"]
        resource_args = ("-n", name, "-g", group, *args)
        try:
            detail = cli("cognitiveservices", "account", "show", *resource_args)
            props = detail.get("properties", {})
            origins = list(props.get("endpoints", {}).values()) + [
                props.get("endpoint", "")
            ]
            origins = [value for value in origins if isinstance(value, str) and value]
            configured = settings.get("endpoint")
            if configured and endpoint(configured) not in {
                origin.rstrip("/").lower() for origin in origins
            }:
                continue
            models = cli("cognitiveservices", "account", "list-models", *resource_args)
            deployments = cli(
                "cognitiveservices", "account", "deployment", "list", *resource_args
            )
        except ChoiceRequired as exc:
            blocked.append({"resource_id": account["id"], "error": str(exc)})
            continue
        catalog = {}
        for record in models:
            key = (
                record.get("format"),
                record.get("name"),
                str(record.get("version", "")),
            )
            catalog[key] = record
            cap = profile(*key, config.get("capability_profiles", []))
            if cap or "image" in str(record.get("capabilities", {})).lower():
                available.append(
                    {
                        "resource_id": account["id"],
                        "region": detail["location"],
                        "model": record,
                        "capability": cap.describe() if cap else None,
                    }
                )
        for deployment in deployments:
            dep_props = deployment.get("properties", {})
            actual = dep_props.get("model", {})
            key = (
                actual.get("format", ""),
                actual.get("name", ""),
                str(actual.get("version", "")),
            )
            record = catalog.get(key, {})
            cap = profile(*key, config.get("capability_profiles", []))
            # Preserve chat and unknown image deployments too; selection evaluates capabilities.
            usable_origins = [
                origin
                for origin in origins
                if (
                    ".services.ai.azure.com" in origin
                    if cap and cap.adapter == "mai"
                    else any(
                        domain in origin
                        for domain in (".openai.azure.com", ".services.ai.azure.com")
                    )
                )
            ]
            if not cap or cap.adapter != "mai":
                usable_origins.sort(key=lambda value: ".openai.azure.com" not in value)
            origin = configured or (usable_origins[0] if usable_origins else "")
            candidates.append(
                Candidate(
                    resource_id=account["id"],
                    account=name,
                    region=detail["location"],
                    endpoint=endpoint(origin) if origin else "",
                    deployment=deployment["name"],
                    provider=key[0],
                    model=key[1],
                    version=key[2],
                    state=dep_props.get("provisioningState", "unknown"),
                    lifecycle=record.get("lifecycleStatus", "unknown"),
                    catalog=record,
                    sku=deployment.get("sku", {}),
                    capability=cap,
                    api_version=settings.get("image_api_version"),
                )
            )
    if settings.get("endpoint") and not candidates and not available and not blocked:
        raise ChoiceRequired(
            "Configured endpoint is not an authorized account endpoint in this subscription."
        )
    return {
        "subscription": subscription,
        "tenant_id": current.get("tenantId"),
        "identity_type": current.get("user", {}).get("type", "unknown"),
        "candidates": candidates,
        "available_models": available,
        "blocked": blocked,
    }


def reasons(candidate: Candidate, config: dict) -> list[str]:
    result = []
    cap = candidate.capability
    if not candidate.version:
        result.append(
            "actual model version is unknown; explicitly pin a deployed version"
        )
    if not candidate.catalog:
        result.append(
            "actual provider/name/version absent from the authorized model catalog"
        )
    if candidate.state != "Succeeded":
        result.append(f"deployment provisioning state: {candidate.state}")
    lifecycle = candidate.lifecycle.lower()
    if lifecycle not in {"generallyavailable", "preview", "ga"}:
        result.append(
            f"lifecycle {candidate.lifecycle!r} is retired, deprecated or unknown; verify catalog"
        )
    if candidate.catalog.get("deprecation"):
        result.append(
            "catalog reports deprecation; choose a non-deprecated model/version"
        )
    catalog_caps = candidate.catalog.get("capabilities", {})
    for key in ("imageGeneration", "image_generation"):
        if key in catalog_caps and str(catalog_caps[key]).lower() == "false":
            result.append("live catalog explicitly disables image generation")
    if not candidate.endpoint:
        result.append("no documented family endpoint found")
    if cap is None:
        result.append(
            "unknown or non-image model; provide a version-specific documented capability profile"
        )
        return result
    if cap.legacy and not config.get("allow_legacy"):
        result.append(
            "legacy fixed-size model requires explicit allow_legacy: true and supported dimensions"
        )
    if cap.adapter == "openai" and not candidate.api_version:
        result.append(
            "set azure.image_api_version to a currently documented image REST API version or v1"
        )
    if (
        cap.adapter == "mai"
        and candidate.endpoint
        and ".services.ai.azure.com" not in candidate.endpoint
    ):
        result.append("MAI requires the resource's services.ai.azure.com endpoint")
    for image in config["images"]:
        if image.get("references"):
            for key in ("imageEdit", "imageEdits"):
                if key in catalog_caps and str(catalog_caps[key]).lower() == "false":
                    result.append("live catalog explicitly disables image edits")
        try:
            cap.validate(
                image.get("size", config["size"]),
                config["quality"],
                len(image.get("references", [])),
                config.get("verify_mai_edit_size", False),
            )
        except ChoiceRequired as exc:
            result.append(f"{image['name']}: {exc}")
    return result


def select(report: dict, config: dict) -> Candidate:
    alias = config.get("azure", {}).get("deployment")
    candidates = [
        candidate
        for candidate in report["candidates"]
        if not alias or candidate.deployment == alias
    ]
    suitable = [candidate for candidate in candidates if not reasons(candidate, config)]
    if len(suitable) == 1 and not report["blocked"]:
        return suitable[0]
    details = [
        {
            "deployment": c.deployment,
            "resource_id": c.resource_id,
            "provider": c.provider,
            "model": c.model,
            "version": c.version,
            "reasons": reasons(c, config),
        }
        for c in candidates
    ]
    raise ChoiceRequired(
        json.dumps(
            {
                "decision": "ambiguous" if len(suitable) > 1 else "absent_or_blocked",
                "action": "Choose azure.resource_id and azure.deployment after comparing capabilities, "
                "native dimensions, edits, detail, realism, lifecycle, freshness and live costs. "
                "If none is suitable, choose an available catalog model; creation needs separate consent.",
                "candidates": details,
                "blocked": report["blocked"],
                "available_models": report["available_models"],
            },
            indent=2,
        )
    )
