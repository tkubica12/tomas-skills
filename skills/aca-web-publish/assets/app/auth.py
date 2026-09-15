"""App-level OAuth/OIDC, intentionally independent of ACA authentication headers."""

from __future__ import annotations

import hmac
import secrets
import time
from collections.abc import Mapping
from typing import Any, Literal

from authlib.integrations.starlette_client import OAuth
from authlib.jose.errors import InvalidClaimError
from authlib.oidc.core import CodeIDToken
from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse

from config import LOGIN_SECONDS, SESSION_SECONDS, Settings, uuid_value


class LoginAttemptError(HTTPException):
    def __init__(self, reason: Literal["missing_session", "invalid_session", "expired", "invalid_callback"]):
        super().__init__(401, "Login expired or invalid")
        self.reason = reason


class StrictCodeIDToken(CodeIDToken):
    def validate_nonce(self) -> None:
        expected = self.params.get("nonce")
        actual = self.get("nonce")
        if not isinstance(expected, str) or not isinstance(actual, str):
            raise InvalidClaimError("nonce")
        if not hmac.compare_digest(expected.encode(), actual.encode()):
            raise InvalidClaimError("nonce")


def identity_from_claims(provider: str, claims: Mapping[str, Any], settings: Settings) -> dict[str, str]:
    """Accept only server-fetched GitHub /user data or library-validated ID-token claims."""
    if provider == "github":
        identifier, name = claims.get("id"), claims.get("login")
        if type(identifier) is not int or identifier < 1 or not isinstance(name, str) or not name:
            raise HTTPException(401, "Invalid provider identity")
        subject = str(identifier)
    elif provider == "google":
        subject = claims.get("sub")
        name = claims.get("email", "") if claims.get("email_verified") is True else ""
    elif provider == "entra":
        tenant = claims.get("tid")
        if not isinstance(tenant, str) or tenant.casefold() != settings.tenant_id:
            raise HTTPException(401, "Invalid provider identity")
        try:
            subject = uuid_value(str(claims.get("oid", "")), "oid")
        except ValueError as exc:
            raise HTTPException(401, "Invalid provider identity") from exc
        name = claims.get("preferred_username") or claims.get("email") or ""
    else:
        raise HTTPException(401, "Invalid provider identity")
    if (
        not isinstance(subject, str) or not subject or len(subject) > 255
        or not isinstance(name, str) or len(name) > 320
        or any(ord(c) < 32 for c in subject + name)
    ):
        raise HTTPException(401, "Invalid provider identity")
    return {"provider": provider, "id": subject, "name": name}


def identity_allowed(identity: Any, settings: Settings) -> bool:
    if not isinstance(identity, dict) or identity.get("provider") != settings.provider:
        return False
    subject, name = identity.get("id"), identity.get("name", "")
    if not isinstance(subject, str) or not subject or not isinstance(name, str):
        return False
    candidates = {f"{settings.provider}:{subject}".casefold()}
    if name:
        candidates.add(name.casefold())
    return bool(candidates & settings.allowed_users)


def reader_authorized(request: Request, settings: Settings) -> bool:
    if settings.provider == "none":
        return True
    expires = request.session.get("expires")
    return (
        type(expires) in {int, float}
        and time.time() < expires <= time.time() + SESSION_SECONDS + 5
        and identity_allowed(request.session.get("identity"), settings)
    )


def create_oauth(settings: Settings) -> OAuth:
    oauth = OAuth()
    if settings.provider == "none":
        return oauth
    options: dict[str, Any] = {
        "client_id": settings.client_id,
        "client_secret": settings.client_secret,
        "client_kwargs": {
            "code_challenge_method": "S256",
            "token_endpoint_auth_method": "client_secret_post",
            "timeout": 20,
            "trust_env": True,
        },
    }
    if settings.provider == "github":
        options.update(
            authorize_url="https://github.com/login/oauth/authorize",
            access_token_url="https://github.com/login/oauth/access_token",
            api_base_url="https://api.github.com/",
        )
        options["client_kwargs"]["scope"] = "read:user"
        options["access_token_params"] = {}
    else:
        options["server_metadata_url"] = (
            "https://accounts.google.com/.well-known/openid-configuration"
            if settings.provider == "google"
            else f"https://login.microsoftonline.com/{settings.tenant_id}/v2.0/.well-known/openid-configuration"
        )
        options["client_kwargs"]["scope"] = "openid email profile"
        options["id_token_signing_alg_values_supported"] = ["RS256"]
    oauth.register(settings.provider, **options)
    return oauth


async def start_login(request: Request, settings: Settings, oauth: OAuth) -> RedirectResponse:
    if settings.provider != "none" and reader_authorized(request, settings):
        return RedirectResponse(settings.public_base_url + "/", status_code=302)
    request.session.clear()
    if settings.provider == "none":
        return RedirectResponse(settings.public_base_url + "/", status_code=302)
    client = oauth.create_client(settings.provider)
    params = {}
    if settings.provider != "github":
        params["nonce"] = secrets.token_urlsafe(32)
    request.session["login_started"] = int(time.time())
    return await client.authorize_redirect(
        request, f"{settings.public_base_url}/oauth/{settings.provider}/callback", **params,
    )


async def finish_login(request: Request, settings: Settings, oauth: OAuth) -> RedirectResponse:
    started = request.session.get("login_started")
    if started is None:
        raise LoginAttemptError("missing_session")
    if type(started) is not int:
        raise LoginAttemptError("invalid_session")
    age = time.time() - started
    if age < 0:
        raise LoginAttemptError("invalid_session")
    if age > LOGIN_SECONDS:
        raise LoginAttemptError("expired")
    if not request.query_params.get("code") or not request.query_params.get("state"):
        raise LoginAttemptError("invalid_callback")
    client = oauth.create_client(settings.provider)
    kwargs = {}
    if settings.provider != "github":
        kwargs = {
            "claims_options": {"iss": {"essential": True, "value": settings.issuer}},
            "claims_cls": StrictCodeIDToken,
            "leeway": 30,
        }
    token = await client.authorize_access_token(request, **kwargs)
    if settings.provider == "github":
        response = await client.get(
            "user", token=token,
            headers={"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
        )
        response.raise_for_status()
        claims = response.json()
    else:
        if not token.get("id_token") or not isinstance(token.get("userinfo"), Mapping):
            raise HTTPException(401, "Provider did not supply a validated ID token")
        claims = token["userinfo"]
    if not isinstance(claims, Mapping):
        raise HTTPException(401, "Invalid provider identity")
    identity = identity_from_claims(settings.provider, claims, settings)
    if not identity_allowed(identity, settings):
        raise HTTPException(403, "User is not allowed")
    # Neither access/refresh/ID tokens nor the OAuth transaction survive login.
    request.session.clear()
    request.session.update(identity=identity, expires=int(time.time()) + SESSION_SECONDS)
    return RedirectResponse(settings.public_base_url + "/", status_code=302)
