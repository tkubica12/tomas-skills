from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from azure.core import MatchConditions
from azure.core.exceptions import ServiceRequestError
from azure.storage.blob import StandardBlobTier
from fastapi import HTTPException
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from starlette.requests import ClientDisconnect

from app import create_app, invalid_path
from auth import identity_allowed, identity_from_claims
from config import BLOCK_BYTES, MAX_BLOCKS, Settings
from storage import AzureBlobStore, upload
from tests.fakes import Entry, MemoryStore, PUBLISH_TOKEN, PUBLISH_TOKEN_SHA256, environment, error


def signed_cookie(settings, identity, *, expires=None):
    body = {"identity": identity, "expires": expires or int(time.time()) + 1000}
    return TimestampSigner(settings.session_secret).sign(base64.b64encode(json.dumps(body).encode())).decode()


class ConfigTests(unittest.TestCase):
    def test_defaults_fail_closed(self):
        env = environment()
        del env["AUTH_PROVIDER"]
        self.assertEqual(Settings.from_env(env).provider, "github")
        del env["GITHUB_CLIENT_SECRET"]
        with self.assertRaisesRegex(ValueError, "GITHUB_CLIENT_SECRET"):
            Settings.from_env(env)

    def test_none_is_explicit_and_still_requires_session_secret(self):
        env = environment()
        env.pop("SESSION_SECRET")
        with self.assertRaisesRegex(ValueError, "SESSION_SECRET"):
            Settings.from_env(env)
        for provider in ("", "unknown", " none"):
            with self.subTest(provider=provider), self.assertRaises(ValueError):
                Settings.from_env(environment(AUTH_PROVIDER=provider))

    def test_invalid_configuration(self):
        cases = [
            ("STORAGE_ACCOUNT_NAME", "https://other.example"),
            ("BLOB_CONTAINER_NAME", "../other"), ("BLOB_CONTAINER_NAME", "site--other"),
            ("AZURE_CLIENT_ID", ""), ("AZURE_CLIENT_ID", "not-a-uuid"),
            ("PUBLIC_BASE_URL", " "), ("PUBLIC_BASE_URL", "http://site.example"),
            ("PUBLIC_BASE_URL", "https://site.example/path"),
            ("PUBLIC_BASE_URL", "https://user:pass@site.example"),
            ("PUBLIC_BASE_URL", "https://site.example?x"),
            ("PUBLIC_BASE_URL", "https://site.example/#"),
            ("PUBLIC_BASE_URL", "https://site.example\\@evil.example"),
            ("PUBLIC_BASE_URL", "https://site.example:bad"),
            ("SESSION_SECRET", "short"), ("UPLOAD_API_ENABLED", "yes"),
            ("UPLOAD_API_TOKEN_SHA256", ""), ("UPLOAD_API_TOKEN_SHA256", PUBLISH_TOKEN),
            ("UPLOAD_API_TOKEN_SHA256", "0" * 63), ("UPLOAD_API_TOKEN_SHA256", "0" * 65),
            ("UPLOAD_API_TOKEN_SHA256", "g" * 64), ("UPLOAD_API_TOKEN_SHA256", " " + "0" * 64),
            ("MAX_UPLOAD_BYTES", "0"), ("MAX_UPLOAD_BYTES", "-1"),
            ("MAX_UPLOAD_BYTES", "unlimited"), ("MAX_UPLOAD_BYTES", "1.5"),
            ("MAX_UPLOAD_BYTES", str(MAX_BLOCKS * BLOCK_BYTES + 1)),
        ]
        for key, value in cases:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                Settings.from_env(environment(**{key: value}))

    def test_local_http_requires_explicit_switch_and_loopback(self):
        self.assertFalse(Settings.from_env(environment(
            PUBLIC_BASE_URL="http://127.0.0.1:8000", LOCAL_DEV="true",
        )).secure_cookie)
        for host, local in (("http://localhost:8000", "false"), ("http://site.example", "true")):
            with self.subTest(host=host), self.assertRaises(ValueError):
                Settings.from_env(environment(PUBLIC_BASE_URL=host, LOCAL_DEV=local))

    def test_explicit_anonymous_bootstrap_allows_missing_or_empty_origin_with_secure_cookie(self):
        for omitted in (True, False):
            env = environment(PUBLIC_BASE_URL="")
            if omitted:
                env.pop("PUBLIC_BASE_URL")
            with self.subTest(omitted=omitted):
                settings = Settings.from_env(env)
                self.assertEqual(settings.provider, "none")
                self.assertEqual(settings.public_base_url, "")
                self.assertTrue(settings.secure_cookie)
                self.assertEqual(settings.cookie_name, "__Host-aca_session")

    def test_authentication_always_requires_explicit_origin(self):
        for provider in (None, "github", "google", "entra"):
            for omitted in (True, False):
                env = environment(PUBLIC_BASE_URL="", AUTH_PROVIDER=provider or "github")
                if provider is None:
                    env.pop("AUTH_PROVIDER")
                if omitted:
                    env.pop("PUBLIC_BASE_URL")
                with self.subTest(provider=provider, omitted=omitted), self.assertRaisesRegex(ValueError, "PUBLIC_BASE_URL"):
                    Settings.from_env(env)

    def test_provider_configuration_is_complete(self):
        for provider in ("github", "google", "entra"):
            for suffix in ("CLIENT_ID", "CLIENT_SECRET"):
                env = environment(AUTH_PROVIDER=provider)
                env.pop(f"{provider.upper()}_{suffix}")
                with self.subTest(provider=provider, suffix=suffix), self.assertRaises(ValueError):
                    Settings.from_env(env)
        for tenant in ("common", "organizations", "consumers", "", "example.com"):
            with self.subTest(tenant=tenant), self.assertRaises(ValueError):
                Settings.from_env(environment(AUTH_PROVIDER="entra", ENTRA_TENANT_ID=tenant))

    def test_management_defaults_disabled_and_limit_finite(self):
        env = environment()
        env.pop("UPLOAD_API_ENABLED")
        env.pop("UPLOAD_API_TOKEN_SHA256")
        settings = Settings.from_env(env)
        self.assertFalse(settings.upload_enabled)
        self.assertEqual(settings.max_upload_bytes, 1024**3)
        self.assertEqual(settings.container, "site")

    def test_management_requires_digest_and_never_falls_back_to_plaintext_key(self):
        env = environment()
        env.pop("UPLOAD_API_TOKEN_SHA256")
        env["UPLOAD_API_KEY"] = PUBLISH_TOKEN
        with self.assertRaisesRegex(ValueError, "UPLOAD_API_TOKEN_SHA256"):
            Settings.from_env(env)
        settings = Settings.from_env(environment(UPLOAD_API_TOKEN_SHA256=PUBLISH_TOKEN_SHA256.upper()))
        self.assertEqual(settings.upload_token_sha256, PUBLISH_TOKEN_SHA256)
        self.assertNotIn(PUBLISH_TOKEN, settings.environment.values())
        self.assertFalse(hasattr(settings, "upload_key"))


class IdentityTests(unittest.TestCase):
    def test_casefold_exact_and_immutable_ids(self):
        settings = Settings.from_env(environment(AUTH_PROVIDER="github", ALLOWED_USERS="Alice, github:42"))
        for claims in ({"id": 1, "login": "ALICE"}, {"id": 42, "login": "renamed"}):
            self.assertTrue(identity_allowed(identity_from_claims("github", claims, settings), settings))
        for login in ("alice-admin", "malice", "alice@example.com"):
            self.assertFalse(identity_allowed({"provider": "github", "id": "1", "name": login}, settings))

    def test_google_email_must_be_verified_but_id_can_be_used(self):
        env = environment(AUTH_PROVIDER="google", ALLOWED_USERS="alice@example.com")
        settings = Settings.from_env(env)
        for verified in (False, "true", 1, None):
            claims = {"sub": "subject-1", "email": "alice@example.com", "email_verified": verified}
            self.assertFalse(identity_allowed(identity_from_claims("google", claims, settings), settings))
        identity = identity_from_claims("google", {
            "sub": "subject-1", "email": "ALICE@example.com", "email_verified": True,
        }, settings)
        self.assertTrue(identity_allowed(identity, settings))
        env["ALLOWED_USERS"] = "google:subject-1"
        identity = identity_from_claims("google", {"sub": "subject-1"}, settings)
        self.assertTrue(identity_allowed(identity, settings))

    def test_entra_tenant_object_id_and_verified_token_alias(self):
        env = environment(AUTH_PROVIDER="entra", ALLOWED_USERS="alice@example.com")
        settings = Settings.from_env(env)
        claims = {
            "tid": settings.tenant_id, "oid": "44444444-4444-4444-8444-444444444444",
            "preferred_username": "ALICE@EXAMPLE.COM",
        }
        identity = identity_from_claims("entra", claims, settings)
        self.assertTrue(identity_allowed(identity, settings))
        env["ALLOWED_USERS"] = "entra:" + claims["oid"]
        self.assertTrue(identity_allowed(identity, settings))
        for changes in ({"tid": "other"}, {"oid": "not-uuid"}, {"tid": None}):
            with self.subTest(changes=changes), self.assertRaises(HTTPException):
                identity_from_claims("entra", claims | changes, settings)

    def test_empty_allowlist_denies_all_and_provider_is_bound(self):
        settings = Settings.from_env(environment(AUTH_PROVIDER="github"))
        self.assertFalse(identity_allowed({"provider": "github", "id": "1", "name": "alice"}, settings))
        settings.environment["ALLOWED_USERS"] = "alice"
        self.assertFalse(identity_allowed({"provider": "google", "id": "1", "name": "alice"}, settings))


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        env = environment(PUBLIC_BASE_URL="", UPLOAD_API_ENABLED="false")
        env.pop("UPLOAD_API_TOKEN_SHA256")
        self.settings = Settings.from_env(env)
        self.store = MemoryStore()
        self.store.entries["index.html"] = Entry(b"bootstrap", "text/html", '"bootstrap"')
        self.client = TestClient(
            create_app(self.settings, lambda _: self.store),
            base_url="https://assigned-ingress.example", follow_redirects=False,
        )
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.assertTrue(self.store.closed)

    def test_health_anonymous_reads_and_disabled_management_without_origin(self):
        self.assertEqual(self.client.get("/healthz").json(), {"status": "ok"})
        self.assertEqual(self.client.head("/healthz").content, b"")
        for method in ("GET", "HEAD", "PUT", "DELETE"):
            self.assertEqual(self.client.request(method, "/_publish/blobs/file").status_code, 404)
        self.assertEqual(self.store.calls, [])
        self.assertEqual(self.client.get("/").content, b"bootstrap")
        self.assertEqual(self.client.head("/").headers["content-length"], "9")
        self.assertEqual(self.client.get("/", headers={"Range": "bytes=0-3"}).content, b"boot")

    def test_bootstrap_never_infers_oauth_or_csrf_origin_from_headers(self):
        response = self.client.get("/login", headers={
            "Host": "evil.example", "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http",
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], "/")
        for provider in ("github", "google", "entra", "none"):
            self.assertEqual(self.client.get(f"/oauth/{provider}/callback").status_code, 404)
        for origin in ("", "null", "https://assigned-ingress.example"):
            self.assertEqual(self.client.post("/logout", headers={"Origin": origin}).status_code, 403)
        self.assertEqual(self.store.calls, [])

    def test_health_is_liveness_not_storage_or_rbac_readiness(self):
        self.store.faults["stat"] = error(403)
        self.assertEqual(self.client.get("/healthz").status_code, 200)
        self.assertEqual(self.store.calls, [])
        with self.assertLogs("aca_web_publish", "WARNING") as logs:
            response = self.client.get("/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Storage unavailable"})
        self.assertNotIn("PRIVATE", str(logs.output) + response.text)
        self.assertEqual(self.client.get("/healthz").status_code, 200)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.env = environment()
        self.settings = Settings.from_env(self.env)
        self.store = MemoryStore()
        self.store.entries["index.html"] = Entry(b"<html>private</html>", "text/html", '"index"')
        self.store.entries["song.mp3"] = Entry(b"0123456789", "audio/mpeg", '"audio"')
        self.app = create_app(self.settings, lambda _: self.store)
        self.client = TestClient(self.app, base_url=self.settings.public_base_url, follow_redirects=False)
        self.client.__enter__()
        self.key = {"Authorization": "Bearer " + PUBLISH_TOKEN}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.assertTrue(self.store.closed)

    def test_create_read_head_update_delete_exact_path(self):
        path = "/_publish/blobs/folder/file.txt"
        response = self.client.put(path, content=b"hello", headers=self.key | {"Content-Type": "text/plain; charset=utf-8"})
        self.assertEqual(response.status_code, 200)
        first_etag = response.headers["etag"]
        self.assertEqual(response.json()["size"], 5)
        self.assertEqual(self.client.get(path, headers=self.key).content, b"hello")
        response = self.client.head(path, headers=self.key)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(response.headers["content-length"], "5")
        self.assertEqual(response.headers["etag"], first_etag)
        self.assertEqual(response.headers["content-type"], "text/plain; charset=utf-8")
        updated = self.client.put(path, headers=self.key | {"If-Match": first_etag}, content=b"updated")
        self.assertEqual(updated.status_code, 200)
        self.assertNotEqual(updated.headers["etag"], first_etag)
        self.assertEqual(self.client.get("/folder/file.txt").content, b"updated")
        self.assertEqual(self.client.delete(path, headers=self.key).status_code, 204)
        self.assertEqual(self.client.get(path, headers=self.key).status_code, 404)
        self.assertIn("index.html", self.store.entries)

    def test_listing_pagination_prefix_and_bound_cursor(self):
        for name in ("a/one", "a/two", "a/three", "b/one"):
            self.client.put("/_publish/blobs/" + name, headers=self.key, content=b"x")
        first = self.client.get("/_publish/blobs", headers=self.key, params={"prefix": "a/"}).json()
        self.assertEqual(len(first["items"]), 2)
        second = self.client.get("/_publish/blobs", headers=self.key, params={
            "prefix": "a/", "cursor": first["next_cursor"],
        }).json()
        self.assertEqual(len(second["items"]), 1)
        self.assertIsNone(second["next_cursor"])
        self.assertEqual({item["path"] for item in first["items"] + second["items"]}, {"a/one", "a/two", "a/three"})
        for params in ({"cursor": "garbage"}, {"prefix": "b/", "cursor": first["next_cursor"]}, {"prefix": "../"}):
            calls = len(self.store.calls)
            self.assertEqual(self.client.get("/_publish/blobs", headers=self.key, params=params).status_code, 400)
            self.assertEqual(len(self.store.calls), calls)

    def test_management_requires_key_on_every_method_and_namespace(self):
        for method in ("GET", "HEAD", "PUT", "DELETE", "POST", "OPTIONS"):
            for path in ("/_publish/blobs", "/_publish/blobs/song.mp3", "/_publish/unknown"):
                for headers in ({}, {"Authorization": "Bearer wrong"}, {"Authorization": "Basic anything"}):
                    with self.subTest(method=method, path=path, headers=headers):
                        response = self.client.request(method, path, headers=headers)
                        self.assertEqual(response.status_code, 401)
                        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertEqual(self.store.calls, [])

    def test_duplicate_auth_rejected(self):
        response = self.client.get("/_publish/blobs", headers=[
            ("Authorization", "Bearer " + PUBLISH_TOKEN),
            ("Authorization", "Bearer wrong"),
        ])
        self.assertEqual(response.status_code, 401)

    def test_management_hashes_token_and_rejects_wrong_tampered_or_digest_tokens(self):
        for token in ("wrong", PUBLISH_TOKEN[:-1] + "X", PUBLISH_TOKEN.swapcase(), PUBLISH_TOKEN_SHA256):
            for method in ("GET", "HEAD", "PUT", "DELETE"):
                with self.subTest(token=token, method=method):
                    response = self.client.request(
                        method, "/_publish/blobs/song.mp3", headers={"Authorization": "Bearer " + token},
                    )
                    self.assertEqual(response.status_code, 401)
        self.assertEqual(self.store.calls, [])
        response = self.client.get("/_publish/blobs/song.mp3", headers=self.key)
        self.assertEqual(response.content, b"0123456789")

    def test_short_token_is_rejected_even_if_its_digest_is_configured(self):
        settings = Settings.from_env(environment(UPLOAD_API_TOKEN_SHA256=hashlib.sha256(b"short").hexdigest()))
        store = MemoryStore()
        with TestClient(create_app(settings, lambda _: store), base_url=settings.public_base_url) as client:
            self.assertEqual(client.get("/_publish/blobs", headers={"Authorization": "Bearer short"}).status_code, 401)
            self.assertEqual(store.calls, [])

    def test_management_accepts_uppercase_digest_configuration(self):
        settings = Settings.from_env(environment(UPLOAD_API_TOKEN_SHA256=PUBLISH_TOKEN_SHA256.upper()))
        store = MemoryStore()
        with TestClient(create_app(settings, lambda _: store), base_url=settings.public_base_url) as client:
            self.assertEqual(client.get("/_publish/blobs", headers=self.key).status_code, 200)

    def test_management_disabled_404_even_with_token_and_digest_removed(self):
        env = environment(UPLOAD_API_ENABLED="false")
        env.pop("UPLOAD_API_TOKEN_SHA256")
        settings = Settings.from_env(env)
        store = MemoryStore()
        with TestClient(create_app(settings, lambda _: store), base_url=settings.public_base_url) as client:
            for method in ("GET", "HEAD", "PUT", "DELETE", "OPTIONS"):
                for path in ("/_publish/blobs", "/_publish/blobs/file", "/_publish/unknown"):
                    for headers in ({}, self.key, {"Authorization": "Bearer wrong"}):
                        with self.subTest(method=method, path=path, headers=headers):
                            self.assertEqual(client.request(method, path, headers=headers).status_code, 404)
            self.assertEqual(store.calls, [])

    def test_ranges_get_head_and_if_range(self):
        cases = [
            ("bytes=0-3", b"0123", "bytes 0-3/10"),
            ("bytes=7-", b"789", "bytes 7-9/10"),
            ("bytes=-4", b"6789", "bytes 6-9/10"),
            ("bytes=7-999", b"789", "bytes 7-9/10"),
            ("bytes=-999", b"0123456789", "bytes 0-9/10"),
        ]
        for path, auth in (("/song.mp3", {}), ("/_publish/blobs/song.mp3", self.key)):
            for value, body, content_range in cases:
                for method in ("GET", "HEAD"):
                    with self.subTest(path=path, value=value, method=method):
                        response = self.client.request(method, path, headers=auth | {"Range": value})
                        self.assertEqual(response.status_code, 206)
                        self.assertEqual(response.content, body if method == "GET" else b"")
                        self.assertEqual(response.headers["content-range"], content_range)
                        self.assertEqual(response.headers["content-length"], str(len(body)))
                        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        response = self.client.get("/song.mp3", headers={"Range": "bytes=0-1", "If-Range": '"old"'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.content), 10)

    def test_range_416_correct_and_head_never_downloads(self):
        for value in ("bytes=10-", "bytes=3-2", "bytes=-0", "bytes=-", "bytes=0-1,3-4", "items=0-1", "bytes=+1-2"):
            for method in ("GET", "HEAD"):
                with self.subTest(value=value, method=method):
                    response = self.client.request(method, "/song.mp3", headers={"Range": value})
                    self.assertEqual(response.status_code, 416)
                    self.assertEqual(response.headers["content-range"], "bytes */10")
                    if method == "HEAD":
                        self.assertEqual(response.content, b"")
        self.store.calls.clear()
        response = self.client.head("/song.mp3")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-length"], "10")
        self.assertEqual(self.store.calls, [("stat", "song.mp3")])

    def test_empty_blob_and_root(self):
        self.assertEqual(self.client.get("/").content, b"<html>private</html>")
        path = "/_publish/blobs/empty.bin"
        self.assertEqual(self.client.put(path, content=b"", headers=self.key).status_code, 200)
        self.assertEqual(self.client.get("/empty.bin").content, b"")
        self.assertEqual(self.client.get("/empty.bin").headers["content-length"], "0")
        response = self.client.get("/empty.bin", headers={"Range": "bytes=0-"})
        self.assertEqual(response.status_code, 416)
        self.assertEqual(response.headers["content-range"], "bytes */0")

    def test_traversal_and_reserved_names(self):
        invalid = ["../x", "./x", "a//b", "a/", "/x", "a\\b", "a\x00b", "a\x1fb", "a/%2f/b",
                   "a/ /b", "_publish/secret", "oauth/content", "LOGIN", "healthz", "logout", "a\u202eb"]
        for path in invalid:
            with self.subTest(path=path):
                self.assertTrue(invalid_path(path))
        for path in (
            "/_publish/blobs/a/%2e%2e/x", "/_publish/blobs/a%2Fb", "/_publish/blobs/a%5Cb",
            "/_publish/blobs/a%252Fb", "/_publish/blobs/a//b", "/_publish/blobs/a%00b",
            "/_publish/blobs/_publish/secret", "/_publish/blobs/oauth/callback", "/_publish/blobs/login",
        ):
            with self.subTest(path=path):
                response = self.client.put(path, headers=self.key, content=b"bad")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.store.calls, [])

    def test_upload_validates_mime_and_length(self):
        for mime in ("text/plain\r\nX-Injected: yes", "not a type", "x" * 300):
            self.assertEqual(self.client.put("/_publish/blobs/x", headers=self.key | {"Content-Type": mime}, content=b"x").status_code, 400)
        settings = Settings.from_env(environment(MAX_UPLOAD_BYTES="3"))
        store = MemoryStore()
        with TestClient(create_app(settings, lambda _: store), base_url=settings.public_base_url) as client:
            response = client.put("/_publish/blobs/x", headers=self.key, content=b"four")
            self.assertEqual(response.status_code, 413)
            self.assertEqual(store.calls, [])
        self.assertEqual(self.store.calls, [])

    def test_atomic_etag_preconditions(self):
        path = "/_publish/blobs/song.mp3"
        for headers in ({"If-Match": '"wrong"'}, {"If-None-Match": "*"}):
            self.assertEqual(self.client.put(path, headers=self.key | headers, content=b"bad").status_code, 412)
        self.assertEqual(self.client.delete(path, headers=self.key | {"If-Match": '"wrong"'}).status_code, 412)
        self.assertEqual(self.store.entries["song.mp3"].data, b"0123456789")
        self.assertEqual(self.client.put("/_publish/blobs/new", headers=self.key | {"If-None-Match": "*"}, content=b"new").status_code, 200)
        self.assertEqual(self.client.put("/_publish/blobs/missing", headers=self.key | {"If-Match": "*"}, content=b"new").status_code, 412)
        for headers in ({"If-Match": 'W/"old"'}, {"If-Match": '"a","b"'}, {"If-None-Match": '"a"'},
                        {"If-Match": "*", "If-None-Match": "*"}, {"If-Unmodified-Since": "anything"}):
            self.assertEqual(self.client.put(path, headers=self.key | headers, content=b"bad").status_code, 400)
        self.assertEqual(self.client.delete(path, headers=self.key | {"If-Match": '"audio"'}).status_code, 204)

    def test_error_mapping_is_sanitized(self):
        for upstream, expected in ((404, 404), (409, 409), (412, 412), (403, 503), (401, 503), (500, 503), (400, 502)):
            with self.subTest(upstream=upstream), self.assertLogs("aca_web_publish", "WARNING") as logs:
                self.store.faults["stat"] = error(upstream)
                response = self.client.get("/song.mp3")
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("PRIVATE", response.text + str(logs.output))
        self.store.faults = {"stat": ServiceRequestError("PRIVATE")}
        with self.assertLogs("aca_web_publish", "WARNING"):
            self.assertEqual(self.client.get("/song.mp3").status_code, 503)

    def test_management_storage_errors_do_not_look_successful(self):
        for operation, method, path in (
            ("list", "GET", "/_publish/blobs"),
            ("delete", "DELETE", "/_publish/blobs/song.mp3"),
            ("commit", "PUT", "/_publish/blobs/song.mp3"),
            ("download", "GET", "/_publish/blobs/song.mp3"),
        ):
            self.store.faults = {operation: error(403)}
            with self.subTest(operation=operation), self.assertLogs("aca_web_publish", "WARNING"):
                response = self.client.request(method, path, headers=self.key)
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("PRIVATE", response.text)

    def test_health_has_no_storage_access_or_sensitive_information(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(self.store.calls, [])
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        self.assertEqual(response.headers["referrer-policy"], "no-referrer")


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.env = environment(AUTH_PROVIDER="github", ALLOWED_USERS="alice")
        self.settings = Settings.from_env(self.env)
        self.store = MemoryStore()
        for path in ("index.html", "image.png", "audio.mp3"):
            self.store.entries[path] = Entry(b"secret", "application/octet-stream", '"1"')
        self.client = TestClient(
            create_app(self.settings, lambda _: self.store),
            base_url=self.settings.public_base_url, follow_redirects=False,
        )
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def authenticate(self, **kwargs):
        cookie = signed_cookie(self.settings, {"provider": "github", "id": "123", "name": "alice"}, **kwargs)
        self.client.cookies.set(self.settings.cookie_name, cookie)
        return cookie

    def test_all_assets_head_and_ranges_require_reader_session(self):
        for path in ("/", "/image.png", "/audio.mp3"):
            for method, expected in (("GET", 302), ("HEAD", 401)):
                with self.subTest(path=path, method=method):
                    response = self.client.request(method, path, headers={"Range": "bytes=0-1"})
                    self.assertEqual(response.status_code, expected)
                    self.assertEqual(response.headers["cache-control"], "private, no-store")
        self.assertEqual(self.store.calls, [])
        self.authenticate()
        self.assertEqual(self.client.get("/image.png").content, b"secret")
        self.assertEqual(self.client.head("/audio.mp3").status_code, 200)
        self.assertEqual(self.client.get("/audio.mp3", headers={"Range": "bytes=0-1"}).content, b"se")

    def test_tampered_expired_and_revoked_sessions_fail(self):
        value = self.authenticate()
        self.client.cookies.clear()
        self.client.cookies.set(self.settings.cookie_name, "X" + value[1:])
        self.assertEqual(self.client.get("/").status_code, 302)
        self.client.cookies.clear()
        self.authenticate(expires=1)
        self.assertEqual(self.client.get("/").status_code, 302)
        self.client.cookies.clear()
        self.authenticate()
        self.env["ALLOWED_USERS"] = ""
        self.assertEqual(self.client.get("/").status_code, 302)
        self.assertEqual(self.store.calls, [])

    def test_reader_cannot_publish_and_key_does_not_grant_reader_session(self):
        self.authenticate()
        for method in ("GET", "HEAD", "PUT", "DELETE"):
            self.assertEqual(self.client.request(method, "/_publish/blobs/image.png").status_code, 401)
        self.client.cookies.clear()
        headers = {"Authorization": "Bearer " + PUBLISH_TOKEN}
        self.assertEqual(self.client.get("/image.png", headers=headers).status_code, 302)
        self.assertEqual(self.client.get("/_publish/blobs/image.png", headers=headers).content, b"secret")

    def test_aca_headers_cannot_authenticate_reader(self):
        response = self.client.get("/", headers={
            "X-MS-CLIENT-PRINCIPAL-NAME": "alice", "X-MS-CLIENT-PRINCIPAL-ID": "123",
            "X-MS-TOKEN-AAD-ID-TOKEN": "unvalidated",
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.store.calls, [])

    def test_logout_is_post_and_requires_exact_origin(self):
        self.authenticate()
        self.assertEqual(self.client.get("/logout").status_code, 404)
        for origin in (None, "https://evil.example", "https://sub.site.example", "null"):
            headers = {} if origin is None else {"Origin": origin}
            self.assertEqual(self.client.post("/logout", headers=headers).status_code, 403)
        response = self.client.post("/logout", headers={"Origin": self.settings.public_base_url})
        self.assertEqual(response.status_code, 204)
        self.assertIn("httponly", response.headers["set-cookie"].lower())
        self.assertIn("secure", response.headers["set-cookie"].lower())
        self.assertIn("samesite=lax", response.headers["set-cookie"].lower())

    def test_login_get_cannot_be_used_as_a_logout_csrf(self):
        self.authenticate()
        response = self.client.get("/login")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], self.settings.public_base_url + "/")
        self.assertEqual(self.client.get("/oauth/github/callback?code=bad&state=bad").status_code, 302)
        self.assertEqual(self.client.get("/").content, b"secret")


class StreamingTests(unittest.IsolatedAsyncioTestCase):
    async def test_bounded_blocks_without_content_length_and_no_partial_commit(self):
        store = MemoryStore()
        store.entries["file"] = Entry(b"previous", "text/plain", '"old"')

        async def body():
            yield b"x" * BLOCK_BYTES
            yield b"overflow"
        with self.assertRaises(HTTPException) as captured:
            await upload(store, "file", body(), "text/plain", BLOCK_BYTES + 1, None, {})
        self.assertEqual(captured.exception.status_code, 413)
        self.assertEqual(store.entries["file"].data, b"previous")
        self.assertTrue(any(call[0] == "stage" for call in store.calls))
        self.assertFalse(any(call[0] == "commit" for call in store.calls))
        self.assertFalse(any(call[0] == "delete" for call in store.calls))

    async def test_successful_blocks_are_bounded_and_unique_per_upload(self):
        store = MemoryStore()

        async def body():
            yield b"a" * (BLOCK_BYTES * 2 + 17)
        size, etag = await upload(store, "file", body(), "text/plain", BLOCK_BYTES * 3, None, {})
        self.assertEqual(size, BLOCK_BYTES * 2 + 17)
        self.assertEqual(store.entries["file"].etag, etag)
        sizes = [call[3] for call in store.calls if call[0] == "stage"]
        self.assertEqual(sizes, [BLOCK_BYTES, BLOCK_BYTES, 17])
        ids = {call[2] for call in store.calls if call[0] == "stage"}
        store.calls.clear()
        await upload(store, "file", body(), "text/plain", BLOCK_BYTES * 3, None, {})
        self.assertFalse(ids & {call[2] for call in store.calls if call[0] == "stage"})

    async def test_disconnect_mismatch_storage_failure_and_cancellation_do_not_commit(self):
        for reason in ("disconnect", "mismatch", "storage", "cancel"):
            store = MemoryStore()
            if reason == "storage":
                store.faults["stage"] = error(503)

            async def body():
                yield b"x" * BLOCK_BYTES
                if reason == "disconnect":
                    raise ClientDisconnect()
                if reason == "cancel":
                    raise asyncio.CancelledError()
            with self.subTest(reason=reason):
                try:
                    await upload(store, "file", body(), "text/plain", BLOCK_BYTES * 2, BLOCK_BYTES + 1, {})
                except (HTTPException, asyncio.CancelledError, type(error(503))):
                    pass
                else:
                    self.fail("Expected aborted upload")
                self.assertNotIn("file", store.entries)
                self.assertFalse(any(call[0] == "commit" for call in store.calls))

    async def test_asgi_upload_enforces_stream_limit_without_length(self):
        settings = Settings.from_env(environment(MAX_UPLOAD_BYTES="5"))
        store = MemoryStore()
        app = create_app(settings, lambda _: store)

        async def body():
            yield b"123"
            yield b"456"
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url=settings.public_base_url) as client:
                response = await client.put(
                    "/_publish/blobs/file",
                    headers={"Authorization": "Bearer " + PUBLISH_TOKEN},
                    content=body(),
                )
                self.assertEqual(response.status_code, 413)
        self.assertNotIn("file", store.entries)

    async def test_sdk_adapter_cool_tier_fixed_identity_and_close(self):
        settings = Settings.from_env(environment())
        credential = MagicMock()
        credential.close = AsyncMock()
        service = MagicMock()
        service.close = AsyncMock()
        container = service.get_container_client.return_value
        blob = container.get_blob_client.return_value
        blob.commit_block_list = AsyncMock(return_value={"etag": '"new"'})
        blob.stage_block = AsyncMock()
        blob.delete_blob = AsyncMock()
        with patch("storage.ManagedIdentityCredential", return_value=credential) as make_credential, \
             patch("storage.BlobServiceClient", return_value=service) as make_service:
            store = AzureBlobStore(settings)
            etag = await store.commit("a/file", ["block1"], "text/plain", {"etag": '"old"', "match_condition": MatchConditions.IfNotModified})
            self.assertEqual(etag, '"new"')
            kwargs = blob.commit_block_list.await_args.kwargs
            self.assertEqual(kwargs["standard_blob_tier"], StandardBlobTier.COOL)
            self.assertEqual(kwargs["content_settings"].content_type, "text/plain")
            self.assertEqual(kwargs["etag"], '"old"')
            await store.stage("a/file", "block1", b"abc")
            blob.stage_block.assert_awaited_once_with("block1", b"abc", length=3)
            await store.delete("a/file", {})
            blob.delete_blob.assert_awaited_once_with()
            await store.close()
            make_credential.assert_called_once_with(client_id=settings.azure_client_id)
            self.assertEqual(make_service.call_args.kwargs["account_url"], "https://testaccount.blob.core.windows.net")
            service.get_container_client.assert_called_once_with("site")
            credential.close.assert_awaited_once()
            service.close.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
