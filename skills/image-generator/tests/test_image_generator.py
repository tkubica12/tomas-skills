from __future__ import annotations

import base64
import contextlib
import io
import json
import shutil
import sys
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

import httpx
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from image_generator.backends import GenerationError, ImageAPI, delay, image_info
from image_generator.capabilities import profile
from image_generator.cli import main
from image_generator.config import ChoiceRequired, load
from image_generator.discovery import Candidate, discover, endpoint, reasons, select
from image_generator.runner import compiler_candidate, identity, offline_plan, run

ORIGIN = "https://example.openai.azure.com"
RESOURCE = "/subscriptions/sub/resourceGroups/group/providers/Microsoft.CognitiveServices/accounts/example"


def png(width=1024, height=1024, color="blue"):
    stream = io.BytesIO()
    Image.new("RGB", (width, height), color).save(stream, format="PNG")
    return stream.getvalue()


def candidate(
    model="gpt-image-2",
    provider="OpenAI",
    alias="arbitrary-alias",
    version="actual-version",
):
    cap = profile(provider, model, version)
    return Candidate(
        resource_id=RESOURCE,
        account="example",
        region="chosen-region",
        endpoint="https://example.services.ai.azure.com"
        if provider == "Microsoft"
        else ORIGIN,
        deployment=alias,
        provider=provider,
        model=model,
        version=version,
        state="Succeeded",
        lifecycle="GenerallyAvailable",
        catalog={
            "name": model,
            "format": provider,
            "version": version,
            "lifecycleStatus": "GenerallyAvailable",
            "capabilities": {"imageGeneration": "true"},
        },
        sku={"name": "SelectedSKU", "capacity": 1},
        capability=cap,
        api_version="explicit-version",
    )


class FakeCLI:
    def __init__(
        self,
        model="gpt-image-2",
        alias="misleading-gpt-image-1",
        provider="OpenAI",
        version="catalog-version",
        blocked=False,
    ):
        self.model, self.alias, self.provider, self.version = (
            model,
            alias,
            provider,
            version,
        )
        self.calls, self.blocked = [], blocked

    def __call__(self, *args):
        self.calls.append(args)
        if args[:2] == ("account", "show"):
            return {"id": "sub", "user": {"type": "user"}, "tenantId": "tenant"}
        account = {
            "id": RESOURCE,
            "name": "example",
            "resourceGroup": "group",
            "kind": "AIServices",
            "location": "chosen-region",
            "properties": {
                "endpoint": ORIGIN,
                "endpoints": {
                    "AI": "https://example.services.ai.azure.com",
                    "OpenAI": ORIGIN,
                },
            },
        }
        if args[1:3] == ("account", "list"):
            return [account]
        if args[1:3] == ("account", "show"):
            return account
        if args[1:3] == ("account", "list-models"):
            if self.blocked:
                raise ChoiceRequired("403 management read denied")
            return [
                {
                    "name": self.model,
                    "format": self.provider,
                    "version": self.version,
                    "lifecycleStatus": "GenerallyAvailable",
                    "capabilities": {"imageGeneration": "true"},
                    "skus": [{"name": "SelectedSKU"}],
                }
            ]
        if args[1:4] == ("account", "deployment", "list"):
            return [
                {
                    "name": self.alias,
                    "sku": {"name": "SelectedSKU", "capacity": 1},
                    "properties": {
                        "provisioningState": "Succeeded",
                        "model": {
                            "format": self.provider,
                            "name": self.model,
                            "version": self.version,
                        },
                    },
                }
            ]
        raise AssertionError(args)


class WorkspaceCase(unittest.TestCase):
    def setUp(self):
        self.folder = Path(__file__).parent / (".work-" + uuid.uuid4().hex)
        self.folder.mkdir()
        self.brief = {
            "common_requirements": "No text or recognizable people. Realistic materials.",
            "size": "1024x1024",
            "quality": "high",
            "instances_per_prompt": 1,
            "max_attempts": 3,
            "azure": {"image_api_version": "explicit-version"},
            "preferences": {"realism": "high", "cost": "compare current prices"},
            "output_dir": str((self.folder / "output").resolve()),
            "images": [
                {
                    "name": "hero",
                    "description": "An abstract landscape",
                    "prompts": ["A luminous landscape, warm light, empty foreground."],
                    "references": [],
                }
            ],
        }

    def tearDown(self):
        shutil.rmtree(self.folder)

    def api(self, raw=None, *, body_extra=None):
        raw = raw if raw is not None else png()
        self.requests = []

        def handle(request):
            self.requests.append(request)
            return httpx.Response(
                200,
                json={
                    "data": [{"b64_json": base64.b64encode(raw).decode()}],
                    **(body_extra or {}),
                },
                headers={"x-request-id": "fake-request-id"},
            )

        client = httpx.Client(
            transport=httpx.MockTransport(handle), follow_redirects=False
        )
        self.addCleanup(client.close)
        return ImageAPI(client, lambda: "FAKE_ENTRA_TOKEN", sleep=lambda _: None)

    def save(self, value=None):
        path = self.folder / "brief.json"
        path.write_text(
            json.dumps(value if value is not None else self.brief), encoding="utf-8"
        )
        return path

    def test_local_loading_defaults_without_cloud_or_compiler(self):
        brief = dict(self.brief)
        brief.pop("size")
        brief.pop("azure")
        loaded = load(self.save(brief))
        self.assertEqual(loaded["size"], "3840x2160")
        self.assertEqual(loaded["azure"], {})
        with patch(
            "image_generator.cli.discover", side_effect=AssertionError("no cloud")
        ):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(self.save())]), 0)
        self.assertIn("offline", offline_plan(self.brief)["mode"])

    def test_auth_is_not_created_or_discovery_attempted_without_consent(self):
        with patch(
            "image_generator.cli.discover", side_effect=AssertionError("no discovery")
        ):
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main([str(self.save()), "--generate"]), 2)

    def test_unknown_configuration_rejected(self):
        for extra in ({"models": ["alias"]}, {"api_key": "no"}, {"parallelism": 30}):
            with self.subTest(extra=extra), self.assertRaises(ChoiceRequired):
                load(self.save({**self.brief, **extra}))

    def test_complete_agent_prompts_required_by_default(self):
        self.brief["images"][0].pop("prompts")
        with self.assertRaisesRegex(ChoiceRequired, "author complete prompts"):
            load(self.save())
        self.brief["prompt_compiler"] = {
            "deployment": "explicit-chat-alias",
            "count": 2,
        }
        self.assertEqual(load(self.save())["prompt_compiler"]["count"], 2)

    def test_relative_reference_resolves_from_brief_and_never_changes(self):
        reference = self.folder / "reference.png"
        reference.write_bytes(png(1024, 1024, "red"))
        self.brief["images"][0]["references"] = ["reference.png"]
        loaded = load(self.save())
        original = reference.read_bytes()
        api = self.api()
        self.assertEqual(
            run(loaded, candidate(), api, emit=lambda _: None)["generated"], 1
        )
        self.assertEqual(reference.read_bytes(), original)
        self.assertIn(original, self.requests[0].content)

    def test_duplicate_and_traversal_names_rejected(self):
        for name in ("../escape", "hero"):
            self.brief["images"].append({**self.brief["images"][0], "name": name})
            with self.assertRaises(ChoiceRequired):
                load(self.save())
            self.brief["images"].pop()

    def test_counts_dimensions_and_unknown_fields_fail_before_calls(self):
        for extra in (
            {"max_attempts": 0},
            {"instances_per_prompt": True},
            {"size": "auto"},
            {"size": "0x2160"},
            {"azure": {"credential": "key"}},
        ):
            with self.subTest(extra=extra), self.assertRaises(ChoiceRequired):
                load(self.save({**self.brief, **extra}))

    def test_discovery_does_not_infer_backend_from_alias(self):
        fake = FakeCLI()
        report = discover(self.brief, fake)
        chosen = select(report, self.brief)
        self.assertEqual(chosen.model, "gpt-image-2")
        self.assertEqual(chosen.version, "catalog-version")
        self.assertEqual(chosen.deployment, "misleading-gpt-image-1")
        self.assertEqual(chosen.capability.adapter, "openai")
        self.assertTrue(
            all(
                not any(
                    write in call
                    for write in ("create", "update", "delete", "set", "keys")
                )
                for call in fake.calls
            )
        )

    def test_explicit_resource_precedes_subscription_wide_search(self):
        self.brief["azure"].update(
            resource_id=RESOURCE, deployment="misleading-gpt-image-1"
        )
        fake = FakeCLI()
        select(discover(self.brief, fake), self.brief)
        self.assertFalse(any(call[1:3] == ("account", "list") for call in fake.calls))
        self.assertTrue(any("--ids" in call for call in fake.calls))

    def test_explicit_endpoint_must_be_owned_and_authorized(self):
        self.brief["azure"]["endpoint"] = "https://different.openai.azure.com"
        with self.assertRaisesRegex(ChoiceRequired, "authorized"):
            discover(self.brief, FakeCLI())

    def test_current_mai_edit_capabilities_not_old_text_only_assumption(self):
        report = discover(
            self.brief, FakeCLI(model="MAI-Image-2.6", provider="Microsoft")
        )
        chosen = report["candidates"][0]
        self.assertEqual(chosen.capability.adapter, "mai")
        self.assertTrue(chosen.capability.edit)
        self.assertEqual(chosen.capability.max_references, 5)
        self.assertTrue(chosen.endpoint.endswith(".services.ai.azure.com"))

    def test_unknown_provider_model_version_and_lifecycle_require_choice(self):
        for change in ("model", "provider", "version", "lifecycle", "state", "catalog"):
            item = candidate()
            if change in ("model", "provider"):
                setattr(item, change, "unknown")
                item.capability = profile(item.provider, item.model, item.version)
            elif change == "version":
                item.version = ""
            elif change == "catalog":
                item.catalog = {}
            else:
                setattr(item, change, "unknown")
            with self.subTest(change=change), self.assertRaises(ChoiceRequired):
                select(
                    {"candidates": [item], "blocked": [], "available_models": []},
                    self.brief,
                )

    def test_ambiguity_requires_explicit_choice_even_when_preferences_exist(self):
        a, b = candidate(), candidate(alias="other")
        report = {"candidates": [a, b], "blocked": [], "available_models": []}
        with self.assertRaisesRegex(ChoiceRequired, "ambiguous"):
            select(report, self.brief)
        self.brief["azure"]["deployment"] = "other"
        self.assertEqual(select(report, self.brief).deployment, "other")

    def test_blocked_discovery_preserves_actionable_error(self):
        report = discover(self.brief, FakeCLI(blocked=True))
        self.assertIn("403", report["blocked"][0]["error"])
        with self.assertRaisesRegex(ChoiceRequired, "403"):
            select(report, self.brief)

    def test_legacy_native_size_needs_explicit_opt_in(self):
        item = candidate("gpt-image-1.5")
        self.assertTrue(reasons(item, self.brief))
        self.brief["allow_legacy"] = True
        self.assertFalse(reasons(item, self.brief))
        self.brief["size"] = "3840x2160"
        self.assertTrue(reasons(item, self.brief))

    def test_api_version_not_hardcoded(self):
        item = candidate()
        item.api_version = None
        self.assertIn("azure.image_api_version", " ".join(reasons(item, self.brief)))
        with self.assertRaises(ChoiceRequired):
            self.api().generate(item, "prompt", "1024x1024", "high", [])
        self.assertEqual(self.requests, [])

    def test_unknown_future_model_can_use_exact_version_evidenced_profile(self):
        override = [
            {
                "provider": "OpenAI",
                "model": "future-model",
                "version": "chosen-v",
                "capability": {
                    "adapter": "openai",
                    "sizes": ["1024x1024"],
                    "edit": True,
                    "max_references": 16,
                    "qualities": ["high"],
                    "native_edit_size": True,
                    "evidence": "https://learn.microsoft.com/example",
                    "checked": "2026-10-14",
                },
            }
        ]
        self.assertIsNotNone(profile("OpenAI", "future-model", "chosen-v", override))
        self.assertIsNone(profile("OpenAI", "future-model", "another-v", override))
        override[0]["capability"]["evidence"] = "https://untrusted.example/docs"
        with self.assertRaises(ChoiceRequired):
            profile("OpenAI", "future-model", "chosen-v", override)

    def test_four_k_is_exact_and_unaligned_or_out_of_budget_rejected(self):
        api = self.api(png(3840, 2160))
        raw, _ = api.generate(candidate(), "prompt", "3840x2160", "high", [])
        self.assertEqual(image_info(raw)["width"], 3840)
        self.assertEqual(json.loads(self.requests[0].content)["size"], "3840x2160")
        for requested in ("3839x2160", "4096x2160", "3840x3840", "1024x256"):
            with self.subTest(size=requested), self.assertRaises(ChoiceRequired):
                api.generate(candidate(), "prompt", requested, "high", [])
        self.assertEqual(len(self.requests), 1)

    def test_mai_native_four_k_rejected_and_standard_quality_explicit(self):
        item = candidate("MAI-Image-2.6", "Microsoft")
        api = self.api()
        for requested, quality in (("3840x2160", "standard"), ("1024x1024", "high")):
            with self.subTest(size=requested), self.assertRaises(ChoiceRequired):
                api.generate(item, "prompt", requested, quality, [])
        raw, _ = api.generate(item, "prompt", "1024x1024", "standard", [])
        body = json.loads(self.requests[0].content)
        self.assertEqual((body["width"], body["height"]), (1024, 1024))
        self.assertNotIn("quality", body)
        self.assertTrue(
            self.requests[0].url.path.endswith("/mai/v1/images/generations")
        )

    def test_mai_edit_has_documented_multipart_fields_and_explicit_size_choice(self):
        item = candidate("MAI-Image-2.6", "Microsoft")
        api = self.api()
        refs = [{"name": f"ref{i}.png", "bytes": png()} for i in range(2)]
        with self.assertRaisesRegex(ChoiceRequired, "verify_mai_edit_size"):
            api.generate(item, "prompt", "1024x1024", "standard", refs)
        api.generate(
            item, "prompt", "1024x1024", "standard", refs, verify_mai_edit_size=True
        )
        request = self.requests[0]
        self.assertTrue(request.url.path.endswith("/mai/v1/images/edits"))
        self.assertEqual(request.content.count(b'name="image"'), 2)
        self.assertNotIn(b'name="width"', request.content)
        self.assertNotIn(b'name="height"', request.content)
        self.assertNotIn(b'name="quality"', request.content)

    def test_encrypted_transport_entra_headers_and_no_redirects(self):
        api = self.api()
        api.generate(candidate(), "prompt", "1024x1024", "high", [])
        request = self.requests[0]
        self.assertEqual(request.headers["Authorization"], "Bearer FAKE_ENTRA_TOKEN")
        self.assertNotIn("api-key", request.headers)
        self.assertIn("api-version=explicit-version", str(request.url))
        self.assertFalse(api.client.follow_redirects)
        for origin in (
            "http://example.openai.azure.com",
            "https://evil.example",
            ORIGIN + "/path",
            "https://user:secret@example.openai.azure.com",
        ):
            with self.subTest(origin=origin), self.assertRaises(ChoiceRequired):
                endpoint(origin)

    def test_retries_bounded_visible_and_token_refreshed(self):
        events, sleeps, tokens, calls = [], [], [], []

        def handle(request):
            calls.append(request)
            return httpx.Response(429, text="quota", headers={"Retry-After": "999"})

        def token():
            tokens.append(1)
            return "FAKE_ENTRA_TOKEN"

        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            api = ImageAPI(
                client, token, attempts=3, sleep=sleeps.append, notify=events.append
            )
            with self.assertRaisesRegex(GenerationError, "429"):
                api.generate(candidate(), "prompt", "1024x1024", "high", [])
        self.assertEqual(len(calls), 3)
        self.assertEqual(len(tokens), 3)
        self.assertEqual(sleeps, [60, 60])
        self.assertEqual(len([e for e in events if "status" in e]), 3)
        self.assertGreaterEqual(delay("Wed, 14 Oct 2026 00:00:00 GMT", 1), 0)

    def test_content_filter_and_auth_failures_not_retried(self):
        for status in (400, 401, 403, 404, 500):
            calls = []

            def handle(request):
                calls.append(request)
                return httpx.Response(status, text="content_policy_violation")

            with (
                self.subTest(status=status),
                httpx.Client(transport=httpx.MockTransport(handle)) as client,
            ):
                api = ImageAPI(
                    client, lambda: "token", sleep=lambda _: self.fail("must not retry")
                )
                with self.assertRaises(GenerationError):
                    api.generate(candidate(), "prompt", "1024x1024", "high", [])
            self.assertEqual(len(calls), 1)

    def test_timeout_is_not_replayed_as_another_paid_request(self):
        calls = []

        def handle(request):
            calls.append(request)
            raise httpx.ReadTimeout("uncertain", request=request)

        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            api = ImageAPI(client, lambda: "token")
            with self.assertRaisesRegex(GenerationError, "Not replayed"):
                api.generate(candidate(), "prompt", "1024x1024", "high", [])
        self.assertEqual(len(calls), 1)

    def test_unknown_url_invalid_base64_and_multi_image_responses_fail(self):
        for data in (
            [{"url": "https://evil.example/image"}],
            [{"b64_json": "not base64"}],
            [],
            [{"b64_json": ""}, {"b64_json": ""}],
        ):
            with (
                self.subTest(data=data),
                httpx.Client(
                    transport=httpx.MockTransport(
                        lambda request: httpx.Response(200, json={"data": data})
                    )
                ) as client,
            ):
                api = ImageAPI(client, lambda: "token")
                with self.assertRaises(GenerationError):
                    api.generate(candidate(), "prompt", "1024x1024", "high", [])

    def test_cache_tracks_brief_prompts_reference_contents_dimensions_quality_model_version(
        self,
    ):
        ref = self.folder / "ref.png"
        ref.write_bytes(png())
        self.brief["images"][0]["references"] = [str(ref.resolve())]
        api = self.api()
        item = candidate()
        first = run(self.brief, item, api, emit=lambda _: None)
        self.assertEqual(first["generated"], 1)
        self.assertEqual(
            run(self.brief, item, api, emit=lambda _: None)["cache_hit"], 1
        )
        self.assertEqual(len(self.requests), 1)
        changes = [
            lambda: self.brief.update(common_requirements="Changed brief"),
            lambda: self.brief["images"][0]["prompts"].append("Different lighting"),
            lambda: ref.write_bytes(png(color="red")),
            lambda: setattr(item, "version", "new-real-version"),
            lambda: self.brief.update(quality="medium"),
        ]
        for change in changes:
            before = len(self.requests)
            change()
            result = run(self.brief, item, api, emit=lambda _: None)
            self.assertGreater(len(self.requests), before)
            self.assertEqual(result["cache_hit"], 0)
        self.brief["size"] = "1536x1024"
        result = run(self.brief, item, self.api(png(1536, 1024)), emit=lambda _: None)
        self.assertEqual(result["generated"], 2)
        manifest = json.loads(Path(result["manifest"]).read_text())
        self.assertEqual(manifest["selected_model"]["version"], "new-real-version")
        self.assertEqual(manifest["records"][0]["returned_image"]["width"], 1536)
        self.assertNotIn("FAKE_ENTRA_TOKEN", Path(result["manifest"]).read_text())

    def test_original_and_reference_archives_survive_dimension_mismatch(self):
        raw = png(768, 768)
        api = self.api(raw)
        result = run(self.brief, candidate(), api, emit=lambda _: None)
        self.assertEqual(result["failed"], 1)
        manifest = json.loads(Path(result["manifest"]).read_text())
        record = manifest["records"][0]
        original = Path(self.brief["output_dir"]) / record["original"]
        self.assertEqual(original.read_bytes(), raw)
        self.assertEqual(record["returned_image"]["width"], 768)
        self.assertEqual(
            run(self.brief, candidate(), api, emit=lambda _: None)["failed"], 1
        )
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(original.read_bytes(), raw)

    def test_corrupt_cache_creates_new_original_without_overwriting_old(self):
        api = self.api()
        first = run(self.brief, candidate(), api, emit=lambda _: None)
        manifest = json.loads(Path(first["manifest"]).read_text())
        original = Path(self.brief["output_dir"]) / manifest["records"][0]["original"]
        original.write_bytes(b"modified by external editor")
        second = run(self.brief, candidate(), api, emit=lambda _: None)
        self.assertEqual(second["generated"], 1)
        self.assertEqual(original.read_bytes(), b"modified by external editor")
        self.assertEqual(len(self.requests), 2)

    def test_returned_model_version_mismatch_is_a_visible_failure(self):
        api = self.api(
            body_extra={"model": "unexpected-model", "model_version": "new-version"}
        )
        result = run(self.brief, candidate(), api, emit=lambda _: None)
        self.assertEqual(result["failed"], 1)
        manifest = json.loads(Path(result["manifest"]).read_text())
        self.assertIn("identity disagrees", manifest["records"][0]["error"])

    def test_invalid_local_reference_fails_before_any_paid_call(self):
        ref = self.folder / "invalid.png"
        ref.write_bytes(b"not an image")
        self.brief["images"][0]["references"] = [str(ref.resolve())]
        api = self.api()
        with self.assertRaises(GenerationError):
            run(self.brief, candidate(), api, emit=lambda _: None)
        self.assertEqual(len(self.requests), 0)

    def test_compiler_is_optional_and_validates_actual_catalog_chat_model(self):
        self.assertIsNone(
            compiler_candidate({"candidates": []}, self.brief, candidate())
        )
        self.brief["images"][0].pop("prompts")
        self.brief["prompt_compiler"] = {"deployment": "chat-alias", "count": 2}
        chat = candidate(
            "real-chat-model", alias="chat-alias", version="real-chat-version"
        )
        chat.catalog["capabilities"] = {"chatCompletion": "true"}
        self.assertIs(
            compiler_candidate({"candidates": [chat]}, self.brief, candidate()), chat
        )
        chat.catalog["capabilities"] = {}
        with self.assertRaises(ChoiceRequired):
            compiler_candidate({"candidates": [chat]}, self.brief, candidate())

    def test_explicit_compiler_cache_has_prompts_and_lineage(self):
        self.brief["images"][0].pop("prompts")
        self.brief["prompt_compiler"] = {"deployment": "chat-alias", "count": 2}
        chat = candidate(
            "real-chat-model", alias="chat-alias", version="real-chat-version"
        )
        calls = []

        def handle(request):
            calls.append(request)
            if "/chat/completions" in request.url.path:
                return httpx.Response(
                    200,
                    json={
                        "choices": [
                            {
                                "message": {
                                    "content": json.dumps(
                                        [
                                            "Complete variation one",
                                            "Complete variation two",
                                        ]
                                    )
                                }
                            }
                        ]
                    },
                )
            return httpx.Response(
                200, json={"data": [{"b64_json": base64.b64encode(png()).decode()}]}
            )

        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            api = ImageAPI(client, lambda: "token")
            result = run(
                self.brief, candidate(), api, compiler=chat, emit=lambda _: None
            )
            self.assertEqual(result["generated"], 2)
            result = run(
                self.brief, candidate(), api, compiler=chat, emit=lambda _: None
            )
            self.assertEqual(result["cache_hit"], 2)
        self.assertEqual(len(calls), 3)
        self.assertEqual(json.loads(calls[0].content)["model"], "chat-alias")
        self.assertEqual(sum("/chat/completions" in r.url.path for r in calls), 1)

    def test_manifest_records_failures_retry_events_and_full_prompts(self):
        with httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(400, text="content_filter")
            )
        ) as client:
            api = ImageAPI(client, lambda: "FAKE_ENTRA_TOKEN")
            result = run(self.brief, candidate(), api, emit=lambda _: None)
        manifest = json.loads(Path(result["manifest"]).read_text())
        self.assertEqual(manifest["events"][0]["status"], 400)
        self.assertEqual(manifest["records"][0]["status"], "failed")
        self.assertIn(
            self.brief["common_requirements"],
            manifest["records"][0]["lineage"]["submitted_prompt"],
        )
        self.assertEqual(identity({"a": 1, "b": 2}), identity({"b": 2, "a": 1}))

    def test_discovery_uses_resource_subscription_without_switching_current_account(
        self,
    ):
        resource = RESOURCE.replace("/subscriptions/sub/", "/subscriptions/other/")
        self.brief["azure"]["resource_id"] = resource
        fake = FakeCLI()

        def cli(*args):
            result = fake(*args)
            if isinstance(result, dict) and "resourceGroup" in result:
                result["id"] = resource
            return result

        report = discover(self.brief, cli)
        self.assertEqual(report["subscription"], "other")
        self.assertEqual(fake.calls[0], ("account", "show", "--subscription", "other"))
        self.assertEqual(report["tenant_id"], "tenant")
        self.brief["azure"]["subscription"] = "different"
        with self.assertRaisesRegex(ChoiceRequired, "disagree"):
            discover(self.brief, cli)

    def test_live_catalog_can_explicitly_disable_documented_capability(self):
        item = candidate()
        item.catalog["capabilities"]["imageGeneration"] = "false"
        self.assertIn("disables image generation", " ".join(reasons(item, self.brief)))

    def test_incomplete_capability_override_cannot_inherit_unknown_edit_support(self):
        override = [
            {
                "provider": "OpenAI",
                "model": "new-model",
                "version": "v",
                "capability": {
                    "adapter": "openai",
                    "sizes": ["1024x1024"],
                    "evidence": "https://learn.microsoft.com/example",
                    "checked": "2026-10-14",
                },
            }
        ]
        with self.assertRaisesRegex(ChoiceRequired, "explicit"):
            profile("OpenAI", "new-model", "v", override)

    def test_openai_edit_uses_documented_array_field_for_multiple_references(self):
        api = self.api()
        api.generate(
            candidate(),
            "prompt",
            "1024x1024",
            "high",
            [{"name": f"ref{i}.png", "bytes": png()} for i in range(2)],
        )
        self.assertEqual(self.requests[0].content.count(b'name="image[]"'), 2)

    def test_modified_lineage_is_not_a_verified_cache_hit(self):
        api = self.api()
        result = run(self.brief, candidate(), api, emit=lambda _: None)
        manifest = json.loads(Path(result["manifest"]).read_text())
        original = Path(self.brief["output_dir"]) / manifest["records"][0]["original"]
        result_file = original.parent / "result.json"
        record = json.loads(result_file.read_text())
        record["lineage"]["quality"] = "modified"
        result_file.write_text(json.dumps(record))
        self.assertEqual(
            run(self.brief, candidate(), api, emit=lambda _: None)["generated"], 1
        )
        self.assertEqual(len(self.requests), 2)

    def test_redirect_or_token_acquisition_failure_is_not_silent(self):
        with httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    302, json={"data": []}, headers={"Location": "https://evil.example"}
                )
            )
        ) as client:
            api = ImageAPI(client, lambda: "token")
            with self.assertRaisesRegex(GenerationError, "redirects"):
                api.generate(candidate(), "prompt", "1024x1024", "high", [])
            api.token = lambda: (_ for _ in ()).throw(
                RuntimeError("credential unavailable")
            )
            with self.assertRaisesRegex(GenerationError, "Entra token"):
                api.generate(candidate(), "prompt", "1024x1024", "high", [])

    def test_strict_four_k_mai_edits_fail_before_token_or_paid_call_even_with_opt_in(
        self,
    ):
        reference = self.folder / "four-k-reference.png"
        reference.write_bytes(png(3840, 2160))
        self.brief["size"] = "3840x2160"
        self.brief["quality"] = "standard"
        self.brief["images"][0]["references"] = [str(reference.resolve())]
        for model in ("MAI-Image-2.5", "MAI-Image-2.6"):
            for verify_only in (False, True):
                with self.subTest(model=model, verify_only=verify_only):
                    self.brief["verify_mai_edit_size"] = verify_only
                    api = self.api()
                    api.token = lambda: self.fail(
                        "must not acquire a token for an unsupported 4K edit"
                    )
                    original_notify = api.notify
                    item = candidate(model, "Microsoft")
                    self.assertIn(
                        "Native 3840x2160 is unsupported",
                        " ".join(reasons(item, self.brief)),
                    )
                    with self.assertRaisesRegex(
                        ChoiceRequired, "Native 3840x2160 is unsupported"
                    ):
                        run(self.brief, item, api, emit=lambda _: None)
                    self.assertEqual(self.requests, [])
                    self.assertIs(api.notify, original_notify)

    def test_unknown_capability_never_invokes_an_invented_family_fallback(self):
        item = candidate(model="unknown-future-image-family", alias="gpt-image-2")
        api = self.api()
        api.token = lambda: self.fail(
            "unknown capability must fail before acquiring a token"
        )
        with self.assertRaisesRegex(ChoiceRequired, "unknown image family"):
            api.generate(item, "prompt", "3840x2160", "high", [])
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
