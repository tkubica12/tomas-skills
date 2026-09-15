"""Private Blob reader and separately authenticated publishing API."""

from __future__ import annotations

import hashlib
import hmac
import logging
import mimetypes
import re
import unicodedata
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import asdict

import httpx
from authlib.integrations.base_client.errors import OAuthError
from authlib.jose.errors import JoseError
from azure.core import MatchConditions
from azure.core.exceptions import AzureError
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from itsdangerous import BadData, URLSafeTimedSerializer
from starlette.middleware.sessions import SessionMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from auth import LoginAttemptError, create_oauth, finish_login, reader_authorized, start_login
from config import LOGIN_SECONDS, SESSION_SECONDS, Settings
from storage import AzureBlobStore, BlobStore, storage_error, upload

logger = logging.getLogger("aca_web_publish")
RESERVED = {"_publish", "login", "logout", "oauth", "healthz"}
MIME = re.compile(
    r"[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+"
    r"(?: *; *[A-Za-z0-9!#$&^_.+-]+=(?:[A-Za-z0-9!#$&^_.+\-]+|\"[A-Za-z0-9 ._+\-]+\"))*"
)
STRONG_ETAG = re.compile(r'"[!#-~]+"')


def login_attempt_response(request: Request, error: LoginAttemptError) -> Response:
    html_quality = 0.0
    for item in request.headers.get("accept", "").lower().split(","):
        media, *parameters = item.split(";")
        if media.strip() != "text/html":
            continue
        quality = "1"
        for parameter in parameters:
            name, _, value = parameter.partition("=")
            if name.strip() == "q":
                quality = value.strip()
        if re.fullmatch(r"(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)", quality):
            html_quality = max(html_quality, float(quality))
    if not html_quality:
        return JSONResponse({"detail": error.detail}, error.status_code)
    title, explanation = {
        "expired": (
            "Sign-in expired",
            f"This sign-in attempt was open for more than {LOGIN_SECONDS // 60} minutes. "
            "Start a new attempt; your Microsoft, Google or GitHub account may still be signed in.",
        ),
        "missing_session": (
            "Sign-in session missing",
            "The browser did not return a valid sign-in cookie. Start again in the same browser "
            "and allow cookies for this site. Switching browsers or clearing cookies can cause this.",
        ),
        "invalid_session": (
            "Sign-in session invalid",
            "This sign-in attempt can no longer be used. Start a new attempt in the same browser.",
        ),
        "invalid_callback": (
            "Sign-in response incomplete",
            "This callback is missing required sign-in information. Start a new attempt.",
        ),
    }[error.reason]
    return HTMLResponse(
        f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{title}</title>
<style>
body {{ margin: 0; background: Canvas; color: CanvasText; font: 18px/1.5 system-ui, sans-serif; }}
main {{ max-width: 38rem; margin: 12vh auto; padding: 2rem; }}
h1 {{ line-height: 1.15; }}
a {{ display: inline-block; padding: .7rem 1rem; border: 2px solid LinkText; border-radius: .4rem; color: LinkText; }}
</style>
</head>
<body>
<main>
<h1>{title}</h1>
<p>{explanation}</p>
<p><a href="/login">Sign in again</a></p>
<p>Do not refresh the old callback address. Access remains protected until sign-in completes.</p>
</main>
</body>
</html>""",
        error.status_code,
        headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"},
    )


def invalid_path(path: str, *, prefix: bool = False, allow_reserved: bool = False) -> bool:
    if prefix and path == "":
        return False
    if prefix and path.endswith("/"):
        path = path[:-1]
    return (
        not path or len(path) > 1024 or any(c in path for c in "\\%?#")
        or any(unicodedata.category(c).startswith("C") for c in path)
        or any(part in {"", ".", ".."} or part != part.strip() for part in path.split("/"))
        or (not allow_reserved and path.split("/", 1)[0].casefold() in RESERVED)
    )


def validate_path(path: str, *, prefix: bool = False) -> str:
    if invalid_path(path, prefix=prefix):
        raise HTTPException(400, "Invalid blob path")
    return path


class RequestBoundary:
    """Guard the entire management namespace, before method/path dispatch."""

    def __init__(self, app: ASGIApp, settings: Settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        path = scope["path"]
        management = path.split("/", 2)[1].casefold() == "_publish" if path.startswith("/") else False
        rejection = None
        if management:
            if not self.settings.upload_enabled:
                rejection = JSONResponse({"detail": "Not found"}, 404)
            else:
                values = request.headers.getlist("authorization")
                parts = values[0].split(" ") if len(values) == 1 else []
                candidate = parts[1] if len(parts) == 2 and parts[0].casefold() == "bearer" else ""
                candidate_digest = hashlib.sha256(candidate.encode("utf-8")).hexdigest()
                digest_matches = hmac.compare_digest(candidate_digest, self.settings.upload_token_sha256)
                if (
                    not digest_matches or len(candidate) < 32
                    or not candidate.isascii() or any(c.isspace() for c in candidate)
                ):
                    rejection = JSONResponse(
                        {"detail": "Publishing credential required"}, 401,
                        headers={"WWW-Authenticate": "Bearer"},
                    )
        raw_path = scope.get("raw_path", b"").lower()
        if rejection is None and (
            any(code in raw_path for code in (b"%2f", b"%5c", b"%25"))
            or (path != "/" and invalid_path(path[1:], allow_reserved=True))
        ):
            rejection = JSONResponse({"detail": "Invalid path"}, 400)

        async def safe_send(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers = [(k, v) for k, v in headers if k.lower() != b"cache-control"]
                headers.extend([
                    (b"cache-control", b"private, no-store"),
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                ])
                message["headers"] = headers
            if message["type"] == "http.response.body" and scope["method"] == "HEAD":
                message["body"] = b""
            await send(message)

        if rejection is not None:
            await rejection(scope, receive, safe_send)
        else:
            await self.app(scope, receive, safe_send)


def byte_range(value: str | None, size: int) -> tuple[int, int] | None:
    if value is None:
        return None
    error = HTTPException(416, "Range not satisfiable", headers={"Content-Range": f"bytes */{size}"})
    match = re.fullmatch(r"bytes=([0-9]*)-([0-9]*)", value)
    if not match or size == 0 or not any(match.groups()) or len(value) > 128:
        raise error
    left, right = match.groups()
    if not left:
        suffix = int(right)
        if suffix == 0:
            raise error
        return max(0, size - suffix), size - 1
    start, end = int(left), int(right) if right else size - 1
    if start >= size or end < start:
        raise error
    return start, min(end, size - 1)


def content_type(path: str, value: str | None, *, uploaded: bool = False) -> str:
    if value:
        if len(value) > 256 or not MIME.fullmatch(value):
            if uploaded:
                raise HTTPException(400, "Invalid Content-Type")
            return "application/octet-stream"
        return value
    guessed = mimetypes.guess_type(path)[0]
    return guessed or "application/octet-stream"


def conditions(request: Request, *, deleting: bool = False) -> dict:
    match = request.headers.get("if-match")
    nonmatch = request.headers.get("if-none-match")
    unsupported = any(name in request.headers for name in ("if-modified-since", "if-unmodified-since"))
    if (
        unsupported or (match and nonmatch)
        or (match is not None and match != "*" and not STRONG_ETAG.fullmatch(match))
        or (nonmatch is not None and (nonmatch != "*" or deleting))
        or len(request.headers.getlist("if-match")) > 1
        or len(request.headers.getlist("if-none-match")) > 1
    ):
        raise HTTPException(400, "Use one strong If-Match ETag or PUT If-None-Match: *")
    if match is not None:
        return {"etag": match, "match_condition": MatchConditions.IfNotModified}
    if nonmatch is not None:
        return {"etag": "*", "match_condition": MatchConditions.IfMissing}
    return {}


async def read_blob(request: Request, path: str, store: BlobStore) -> Response:
    iterator = None
    try:
        info = await store.stat(path)
        selected = byte_range(
            request.headers.get("range") if request.headers.get("if-range", info.etag) == info.etag else None,
            info.size,
        )
        start, end = selected if selected else (0, info.size - 1)
        length = end - start + 1
        headers = {
            "Content-Type": content_type(path, info.content_type),
            "Content-Length": str(length), "ETag": info.etag, "Accept-Ranges": "bytes",
        }
        if selected:
            headers["Content-Range"] = f"bytes {start}-{end}/{info.size}"
        status = 206 if selected else 200
        if request.method == "HEAD" or length == 0:
            return Response(status_code=status, headers=headers)
        iterator = await store.download(path, start, length, info.etag)
        first = await anext(iterator)
    except StopAsyncIteration:
        logger.warning("storage_failure operation=download reason=unexpected_empty_stream")
        raise HTTPException(502, "Storage response incomplete") from None
    except AzureError as exc:
        if iterator is not None:
            close = getattr(iterator, "aclose", None)
            if close:
                await close()
        raise storage_error(exc, "read") from None

    async def stream():
        delivered = 0
        try:
            delivered += len(first)
            yield first
            async for chunk in iterator:
                delivered += len(chunk)
                yield chunk
            if delivered != length:
                logger.warning("storage_failure operation=stream reason=length_mismatch")
                raise ConnectionError("Storage stream interrupted")
        except AzureError as exc:
            storage_error(exc, "stream")
            # Headers are already sent. Abort rather than return a truncated success.
            raise ConnectionError("Storage stream interrupted") from None
        finally:
            close = getattr(iterator, "aclose", None)
            if close:
                await close()

    return StreamingResponse(stream(), status_code=status, headers=headers)


def create_app(
    settings: Settings | None = None,
    storage_factory: Callable[[Settings], BlobStore] = AzureBlobStore,
) -> FastAPI:
    settings = Settings.from_env() if settings is None else settings
    oauth = create_oauth(settings)
    cursors = URLSafeTimedSerializer(settings.session_secret, salt="aca-publish-list-v1")

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        store = storage_factory(settings)
        application.state.store = store
        try:
            yield
        finally:
            await store.close()

    application = FastAPI(
        title="Private Blob publisher", docs_url=None, redoc_url=None, openapi_url=None,
        redirect_slashes=False, lifespan=lifespan,
    )
    application.state.oauth = oauth
    application.add_middleware(
        SessionMiddleware, secret_key=settings.session_secret, session_cookie=settings.cookie_name,
        max_age=SESSION_SECONDS, same_site="lax", https_only=settings.secure_cookie,
    )
    application.add_middleware(RequestBoundary, settings=settings)

    @application.api_route("/healthz", methods=["GET", "HEAD"])
    async def healthz():
        return {"status": "ok"}

    async def oauth_failure(request: Request, action) -> Response:
        try:
            return await action(request, settings, oauth)
        except LoginAttemptError as exc:
            request.session.clear()
            logger.warning("oauth_rejected reason=%s", exc.reason)
            return login_attempt_response(request, exc)
        except HTTPException:
            request.session.clear()
            raise
        except (OAuthError, JoseError, ValueError, TypeError, KeyError) as exc:
            request.session.clear()
            logger.warning("oauth_rejected type=%s", type(exc).__name__)
            return JSONResponse({"detail": "Login failed"}, 401)
        except httpx.HTTPError as exc:
            request.session.clear()
            logger.warning("oauth_unavailable type=%s", type(exc).__name__)
            return JSONResponse({"detail": "Identity provider unavailable"}, 502)

    @application.get("/login")
    async def login(request: Request):
        return await oauth_failure(request, start_login)

    @application.get("/oauth/{provider}/callback")
    async def callback(provider: str, request: Request):
        if provider != settings.provider or settings.provider == "none":
            raise HTTPException(404, "Not found")
        if reader_authorized(request, settings):
            return RedirectResponse(settings.public_base_url + "/", status_code=302)
        return await oauth_failure(request, finish_login)

    @application.post("/logout")
    async def logout(request: Request):
        # Mandatory exact Origin protects POST logout even against same-site siblings.
        if not settings.public_base_url or request.headers.get("origin") != settings.public_base_url:
            raise HTTPException(403, "Same-origin request required")
        request.session.clear()
        return Response(status_code=204)

    @application.get("/_publish/blobs")
    async def list_blobs(request: Request, prefix: str = "", cursor: str | None = None):
        validate_path(prefix, prefix=True)
        marker = None
        if cursor is not None:
            if len(cursor) > 16_384:
                raise HTTPException(400, "Invalid listing cursor")
            try:
                payload = cursors.loads(cursor, max_age=86_400)
                if payload["prefix"] != prefix or not isinstance(payload["marker"], str):
                    raise BadData("Cursor does not match prefix")
                marker = payload["marker"]
            except (BadData, KeyError, TypeError):
                raise HTTPException(400, "Invalid listing cursor") from None
        try:
            items, marker = await request.app.state.store.list(prefix, marker)
        except AzureError as exc:
            raise storage_error(exc, "list") from None
        return {
            "items": [asdict(item) for item in items],
            "next_cursor": cursors.dumps({"prefix": prefix, "marker": marker}) if marker else None,
        }

    @application.api_route("/_publish/blobs/{blob_path:path}", methods=["GET", "HEAD"])
    async def get_published_blob(request: Request, blob_path: str):
        return await read_blob(request, validate_path(blob_path), request.app.state.store)

    @application.put("/_publish/blobs/{blob_path:path}")
    async def put_blob(request: Request, blob_path: str):
        path = validate_path(blob_path)
        write_condition = conditions(request)
        values = request.headers.getlist("content-length")
        if len(values) > 1 or (values and not re.fullmatch(r"[0-9]{1,12}", values[0])):
            raise HTTPException(400, "Invalid Content-Length")
        if values and "transfer-encoding" in request.headers:
            raise HTTPException(400, "Ambiguous body framing")
        length = int(values[0]) if values else None
        if length is not None and length > settings.max_upload_bytes:
            raise HTTPException(413, "Upload exceeds MAX_UPLOAD_BYTES")
        if len(request.headers.getlist("content-type")) > 1:
            raise HTTPException(400, "Invalid Content-Type")
        mime = content_type(path, request.headers.get("content-type"), uploaded=True)
        try:
            size, etag = await upload(
                request.app.state.store, path, request.stream(), mime,
                settings.max_upload_bytes, length, write_condition,
            )
        except AzureError as exc:
            raise storage_error(exc, "upload") from None
        return JSONResponse(
            {"path": path, "size": size, "content_type": mime, "etag": etag},
            headers={"ETag": etag},
        )

    @application.delete("/_publish/blobs/{blob_path:path}")
    async def delete_blob(request: Request, blob_path: str):
        path = validate_path(blob_path)
        condition = conditions(request, deleting=True)
        try:
            await request.app.state.store.delete(path, condition)
        except AzureError as exc:
            raise storage_error(exc, "delete") from None
        return Response(status_code=204)

    @application.api_route("/{blob_path:path}", methods=["GET", "HEAD"])
    async def site(request: Request, blob_path: str):
        if blob_path.split("/", 1)[0].casefold() in RESERVED:
            raise HTTPException(404, "Not found")
        if not reader_authorized(request, settings):
            if request.method == "HEAD":
                raise HTTPException(401, "Reader login required")
            return RedirectResponse(settings.public_base_url + "/login", status_code=302)
        return await read_blob(request, validate_path(blob_path or "index.html"), request.app.state.store)

    return application
