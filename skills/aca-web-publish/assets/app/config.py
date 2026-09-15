"""Validated startup configuration. Authentication is never implicitly disabled."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from urllib.parse import urlsplit
from uuid import UUID

BLOCK_BYTES = 4 * 1024 * 1024
MAX_BLOCKS = 50_000
LOGIN_SECONDS = 10 * 60
SESSION_SECONDS = 8 * 60 * 60
LOCAL_DEV_VARIABLE = "LOCAL_DEV"


def required(env: Mapping[str, str], name: str) -> str:
    value = env.get(name, "")
    if not value or value != value.strip() or any(ord(c) < 32 for c in value):
        raise ValueError(f"{name} must be configured without surrounding whitespace or controls")
    return value


def boolean(env: Mapping[str, str], name: str, default: str = "false") -> bool:
    value = env.get(name, default).casefold()
    if value not in {"true", "false"}:
        raise ValueError(f"{name} must be true or false")
    return value == "true"


def uuid_value(value: str, name: str) -> str:
    try:
        parsed = UUID(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a UUID") from exc
    if str(parsed) != value.casefold():
        raise ValueError(f"{name} must be a canonical UUID")
    return str(parsed)


def canonical_origin(value: str, local_dev: bool) -> str:
    try:
        parsed = urlsplit(value)
        port = parsed.port
        host = parsed.hostname
    except ValueError as exc:
        raise ValueError("PUBLIC_BASE_URL must be a canonical origin") from exc
    if (
        not host
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
        or any(c in value for c in ("\\", "%", "?", "#"))
        or any(c.isspace() for c in value)
        or not re.fullmatch(r"[A-Za-z0-9.:\-\[\]]+", host)
        or port == 0
        or parsed.netloc.endswith(":")
    ):
        raise ValueError("PUBLIC_BASE_URL must be an origin without credentials, path, query or fragment")
    local_http = local_dev and host in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (parsed.scheme == "http" and local_http):
        raise ValueError("PUBLIC_BASE_URL requires HTTPS (LOCAL_DEV=true permits loopback HTTP only)")
    authority = f"[{host.lower()}]" if ":" in host else host.lower()
    if port is not None and port != (443 if parsed.scheme == "https" else 80):
        authority += f":{port}"
    return f"{parsed.scheme}://{authority}"


@dataclass(frozen=True)
class Settings:
    storage_account: str
    container: str
    azure_client_id: str
    public_base_url: str
    provider: str
    session_secret: str = field(repr=False)
    upload_enabled: bool
    upload_token_sha256: str = field(repr=False)
    max_upload_bytes: int
    local_dev: bool
    client_id: str
    client_secret: str = field(repr=False)
    tenant_id: str
    # Keep the source live: changing the allowlist invalidates existing reader sessions.
    environment: Mapping[str, str] = field(repr=False, compare=False)

    @property
    def allowed_users(self) -> set[str]:
        return {
            item.strip().casefold()
            for item in self.environment.get("ALLOWED_USERS", "").split(",")
            if item.strip()
        }

    @property
    def secure_cookie(self) -> bool:
        return not self.public_base_url.startswith("http://")

    @property
    def cookie_name(self) -> str:
        return "__Host-aca_session" if self.secure_cookie else "aca_session"

    @property
    def issuer(self) -> str:
        if self.provider == "google":
            return "https://accounts.google.com"
        if self.provider == "entra":
            return f"https://login.microsoftonline.com/{self.tenant_id}/v2.0"
        raise ValueError("Provider is not OIDC")

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if env is None else env
        account = required(env, "STORAGE_ACCOUNT_NAME")
        if not re.fullmatch(r"[a-z0-9]{3,24}", account):
            raise ValueError("STORAGE_ACCOUNT_NAME must be an Azure storage account name")
        container = env.get("BLOB_CONTAINER_NAME", "site")
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", container) or "--" in container:
            raise ValueError("BLOB_CONTAINER_NAME must be a regular private container name")
        identity = uuid_value(required(env, "AZURE_CLIENT_ID"), "AZURE_CLIENT_ID")
        local_dev = boolean(env, LOCAL_DEV_VARIABLE)
        provider = env.get("AUTH_PROVIDER", "github").casefold()
        if provider not in {"none", "github", "google", "entra"}:
            raise ValueError("AUTH_PROVIDER must be none, github, google or entra")
        # ACA assigns the ingress hostname after creation; only explicit anonymous
        # bootstrap may omit it. Never derive an OAuth origin from request headers.
        origin = (
            "" if provider == "none" and env.get("PUBLIC_BASE_URL", "") == ""
            else canonical_origin(required(env, "PUBLIC_BASE_URL"), local_dev)
        )
        session_secret = required(env, "SESSION_SECRET")
        if len(session_secret.encode("utf-8")) < 32:
            raise ValueError("SESSION_SECRET must contain at least 32 bytes; generate it randomly")
        upload_enabled = boolean(env, "UPLOAD_API_ENABLED")
        upload_token_sha256 = required(env, "UPLOAD_API_TOKEN_SHA256").lower() if upload_enabled else ""
        if upload_enabled and not re.fullmatch(r"[0-9a-f]{64}", upload_token_sha256):
            raise ValueError("UPLOAD_API_TOKEN_SHA256 must be the 64-hex SHA256 digest of the bearer token")
        max_upload = env.get("MAX_UPLOAD_BYTES", str(1024**3))
        if not re.fullmatch(r"[0-9]{1,12}", max_upload):
            raise ValueError("MAX_UPLOAD_BYTES must be a finite positive byte count")
        max_upload_bytes = int(max_upload)
        if not 1 <= max_upload_bytes <= BLOCK_BYTES * MAX_BLOCKS:
            raise ValueError(f"MAX_UPLOAD_BYTES must be between 1 and {BLOCK_BYTES * MAX_BLOCKS}")
        client_id = client_secret = tenant_id = ""
        if provider != "none":
            client_id = required(env, f"{provider.upper()}_CLIENT_ID")
            client_secret = required(env, f"{provider.upper()}_CLIENT_SECRET")
        if provider == "entra":
            tenant_id = uuid_value(required(env, "ENTRA_TENANT_ID"), "ENTRA_TENANT_ID")
            client_id = uuid_value(client_id, "ENTRA_CLIENT_ID")
        return cls(
            account, container, identity, origin, provider, session_secret,
            upload_enabled, upload_token_sha256, max_upload_bytes, local_dev,
            client_id, client_secret, tenant_id, env,
        )
