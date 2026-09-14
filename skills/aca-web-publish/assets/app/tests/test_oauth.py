from __future__ import annotations

import base64
import hashlib
import json
import time
import unittest
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
from authlib.integrations.httpx_client import AsyncOAuth2Client
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner

from app import create_app
from config import Settings
from tests.fakes import Entry, MemoryStore, environment


class OAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(cls.key.public_key()))
        cls.jwk.update(kid="test-key", use="sig", alg="RS256")

    def setup_provider(self, provider, *, allowed="alice@example.com", mutate_claims=None, token_override=None):
        env = environment(AUTH_PROVIDER=provider, ALLOWED_USERS=allowed)
        settings = Settings.from_env(env)
        store = MemoryStore()
        store.entries["index.html"] = Entry(b"private content", "text/html", '"1"')
        app = create_app(settings, lambda _: store)
        calls = []
        authorization = {}

        def handler(request):
            calls.append(request)
            if ".well-known" in request.url.path:
                return httpx.Response(200, json={
                    "issuer": settings.issuer,
                    "authorization_endpoint": "https://idp.example/authorize",
                    "token_endpoint": "https://idp.example/token",
                    "jwks_uri": "https://idp.example/keys",
                    "id_token_signing_alg_values_supported": ["RS256"],
                })
            if request.url.path == "/keys":
                return httpx.Response(200, json={"keys": [self.jwk]})
            if request.url.path in {"/token", "/login/oauth/access_token"}:
                params = parse_qs(request.content.decode())
                self.assertEqual(params["redirect_uri"], [settings.public_base_url + f"/oauth/{provider}/callback"])
                self.assertEqual(params["client_id"], [settings.client_id])
                self.assertEqual(params["client_secret"], [settings.client_secret])
                self.assertEqual(params["code"], ["test-code"])
                verifier = params["code_verifier"][0]
                challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
                self.assertEqual(challenge, authorization["code_challenge"][0])
                token = {"access_token": "provider-token-do-not-persist", "token_type": "Bearer"}
                if provider != "github":
                    claims = {
                        "iss": settings.issuer, "aud": settings.client_id, "sub": "stable-subject",
                        "iat": int(time.time()), "exp": int(time.time()) + 300,
                        "nonce": authorization["nonce"][0],
                        "email": "alice@example.com", "email_verified": True,
                        "tid": settings.tenant_id,
                        "oid": "44444444-4444-4444-8444-444444444444",
                        "preferred_username": "alice@example.com",
                    }
                    if mutate_claims:
                        mutate_claims(claims)
                    signing_key = self.other_key if claims.pop("_bad_signature", False) else self.key
                    token["id_token"] = jwt.encode(claims, signing_key, algorithm="RS256", headers={"kid": "test-key"})
                if token_override:
                    token = token_override(token)
                return httpx.Response(200, json=token)
            if request.url.host == "api.github.com" and request.url.path == "/user":
                self.assertEqual(request.headers["authorization"], "Bearer provider-token-do-not-persist")
                return httpx.Response(200, json={"id": 123, "login": "alice"})
            self.fail("Unexpected OAuth HTTP request: " + str(request.url))

        class MockOAuthClient(AsyncOAuth2Client):
            def __init__(self, *args, **kwargs):
                kwargs["transport"] = httpx.MockTransport(handler)
                super().__init__(*args, **kwargs)

        app.state.oauth.create_client(provider).client_cls = MockOAuthClient
        client = TestClient(app, base_url=settings.public_base_url, follow_redirects=False)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        response = client.get("/login")
        self.assertIn(response.status_code, {302, 307})
        authorization.update(parse_qs(urlsplit(response.headers["location"]).query))
        self.assertEqual(authorization["redirect_uri"], [settings.public_base_url + f"/oauth/{provider}/callback"])
        self.assertEqual(authorization["code_challenge_method"], ["S256"])
        self.assertIn("state", authorization)
        if provider != "github":
            self.assertIn("nonce", authorization)
        return client, settings, calls, authorization

    def complete(self, client, settings, authorization, **overrides):
        params = {"code": "test-code", "state": authorization["state"][0]} | overrides
        return client.get(f"/oauth/{settings.provider}/callback", params=params)

    def test_github_uses_validated_state_pkce_and_server_fetched_user(self):
        client, settings, calls, authorization = self.setup_provider("github", allowed="Alice")
        response = self.complete(client, settings, authorization)
        self.assertEqual(response.status_code, 302, response.text)
        self.assertTrue(any(request.url.host == "api.github.com" for request in calls))
        self.assertEqual(client.get("/").content, b"private content")
        self.check_minimal_cookie(response, settings)

    def test_google_and_tenant_specific_entra_full_library_validation(self):
        for provider in ("google", "entra"):
            with self.subTest(provider=provider):
                client, settings, calls, authorization = self.setup_provider(provider)
                response = self.complete(client, settings, authorization)
                self.assertEqual(response.status_code, 302, response.text)
                self.assertEqual(client.get("/").content, b"private content")
                self.assertTrue(any(request.url.path == "/keys" for request in calls))
                self.check_minimal_cookie(response, settings)

    def check_minimal_cookie(self, response, settings):
        header = response.headers["set-cookie"]
        self.assertIn("httponly", header.lower())
        self.assertIn("secure", header.lower())
        self.assertIn("samesite=lax", header.lower())
        self.assertNotIn("domain=", header.lower())
        value = header.split(";", 1)[0].split("=", 1)[1]
        decoded = json.loads(base64.b64decode(TimestampSigner(settings.session_secret).unsign(value)))
        self.assertEqual(set(decoded), {"identity", "expires"})
        self.assertEqual(set(decoded["identity"]), {"provider", "id", "name"})
        self.assertNotIn("token", json.dumps(decoded).lower())

    def test_state_mismatch_never_exchanges_code(self):
        for provider in ("github", "google", "entra"):
            with self.subTest(provider=provider):
                client, settings, calls, authorization = self.setup_provider(provider)
                count = len(calls)
                with self.assertLogs("aca_web_publish", "WARNING"):
                    response = self.complete(client, settings, authorization, state="wrong")
                self.assertEqual(response.status_code, 401)
                self.assertEqual(len(calls), count)

    def test_signed_callback_cookie_cannot_be_replaced_or_provider_switched(self):
        client, settings, calls, authorization = self.setup_provider("github")
        count = len(calls)
        response = client.get("/oauth/google/callback", params={"code": "test-code", "state": authorization["state"][0]})
        self.assertEqual(response.status_code, 404)
        client.cookies.clear()
        client.cookies.set(settings.cookie_name, "forged")
        self.assertEqual(self.complete(client, settings, authorization).status_code, 401)
        self.assertEqual(len(calls), count)

    def test_oidc_invalid_signature_issuer_audience_expiry_and_nonce_rejected(self):
        changes = [
            {"iss": "https://evil.example"}, {"aud": "another-client"}, {"_bad_signature": True},
            {"exp": 1}, {"nonce": "wrong"}, {"nonce": None},
            {"nonce_supported": False, "nonce": "wrong"}, {"azp": "another-client"},
        ]
        for changeset in changes:
            with self.subTest(changeset=changeset):
                client, settings, calls, authorization = self.setup_provider(
                    "google", mutate_claims=lambda claims: claims.update(changeset),
                )
                with self.assertLogs("aca_web_publish", "WARNING") as logs:
                    response = self.complete(client, settings, authorization)
                self.assertEqual(response.status_code, 401, response.text)
                self.assertEqual(client.get("/").status_code, 302)
                self.assertNotIn("provider-token", str(logs.output))

    def test_oidc_missing_id_token_cannot_supply_forged_userinfo(self):
        def override(token):
            return {
                "access_token": token["access_token"], "token_type": "Bearer",
                "userinfo": {"sub": "evil", "email": "alice@example.com", "email_verified": True},
            }
        client, settings, calls, authorization = self.setup_provider("google", token_override=override)
        self.assertEqual(self.complete(client, settings, authorization).status_code, 401)
        self.assertEqual(client.get("/").status_code, 302)

    def test_google_unverified_email_and_empty_allowlist_fail_closed(self):
        for provider, allowed, changes in (
            ("google", "alice@example.com", {"email_verified": False}),
            ("github", "", {}),
            ("entra", "", {}),
            ("entra", "alice@example.com", {"tid": "other-tenant"}),
        ):
            with self.subTest(provider=provider, changes=changes):
                client, settings, calls, authorization = self.setup_provider(
                    provider, allowed=allowed, mutate_claims=lambda claims: claims.update(changes),
                )
                self.assertIn(self.complete(client, settings, authorization).status_code, {401, 403})
                self.assertEqual(client.get("/").status_code, 302)

    def test_canonical_callback_does_not_trust_host_or_forwarded_headers(self):
        client, settings, calls, authorization = self.setup_provider("github")
        response = client.get("/login", headers={
            "Host": "evil.example", "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http",
        })
        params = parse_qs(urlsplit(response.headers["location"]).query)
        self.assertEqual(params["redirect_uri"], [settings.public_base_url + "/oauth/github/callback"])


if __name__ == "__main__":
    unittest.main()
