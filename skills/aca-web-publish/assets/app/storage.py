"""Async fixed-container storage adapter and bounded atomic block uploads."""

from __future__ import annotations

import base64
import logging
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

from azure.core import MatchConditions
from azure.core.exceptions import AzureError, HttpResponseError
from azure.identity.aio import ManagedIdentityCredential
from azure.storage.blob import ContentSettings, StandardBlobTier
from azure.storage.blob.aio import BlobServiceClient
from fastapi import HTTPException
from starlette.requests import ClientDisconnect

from config import BLOCK_BYTES, Settings

logger = logging.getLogger("aca_web_publish")


@dataclass(frozen=True)
class BlobInfo:
    path: str
    size: int
    content_type: str
    etag: str


class BlobStore(Protocol):
    async def stat(self, path: str) -> BlobInfo: ...
    async def download(self, path: str, offset: int, length: int, etag: str) -> AsyncIterator[bytes]: ...
    async def stage(self, path: str, block_id: str, data: bytes) -> None: ...
    async def commit(self, path: str, block_ids: list[str], content_type: str, condition: dict) -> str: ...
    async def delete(self, path: str, condition: dict) -> None: ...
    async def list(self, prefix: str, marker: str | None) -> tuple[list[BlobInfo], str | None]: ...
    async def close(self) -> None: ...


def storage_error(exc: AzureError, operation: str) -> HTTPException:
    status = getattr(exc, "status_code", None)
    # Exception messages and tracebacks may contain account URLs, headers or SAS.
    logger.warning("storage_failure operation=%s type=%s status=%s", operation, type(exc).__name__, status)
    if isinstance(exc, HttpResponseError):
        if status == 404:
            return HTTPException(404, "Blob not found")
        if status == 409:
            return HTTPException(409, "Storage conflict")
        if status == 412:
            return HTTPException(412, "ETag precondition failed")
        if status == 416:
            return HTTPException(416, "Range not satisfiable")
        if status == 400:
            return HTTPException(502, "Storage request failed")
    return HTTPException(503, "Storage unavailable")


class AzureBlobStore:
    def __init__(self, settings: Settings):
        self.credential = ManagedIdentityCredential(client_id=settings.azure_client_id)
        self.service = BlobServiceClient(
            account_url=f"https://{settings.storage_account}.blob.core.windows.net",
            credential=self.credential,
            max_single_get_size=BLOCK_BYTES,
            max_chunk_get_size=BLOCK_BYTES,
            retry_total=2,
            connection_timeout=10,
            read_timeout=60,
            logging_enable=False,
        )
        self.container = self.service.get_container_client(settings.container)

    async def close(self) -> None:
        try:
            await self.service.close()
        finally:
            await self.credential.close()

    async def stat(self, path: str) -> BlobInfo:
        value = await self.container.get_blob_client(path).get_blob_properties()
        return BlobInfo(path, value.size, value.content_settings.content_type, value.etag)

    async def download(self, path: str, offset: int, length: int, etag: str) -> AsyncIterator[bytes]:
        stream = await self.container.get_blob_client(path).download_blob(
            offset=offset, length=length, etag=etag,
            match_condition=MatchConditions.IfNotModified, max_concurrency=1,
        )
        return stream.chunks()

    async def stage(self, path: str, block_id: str, data: bytes) -> None:
        await self.container.get_blob_client(path).stage_block(block_id, data, length=len(data))

    async def commit(self, path: str, block_ids: list[str], content_type: str, condition: dict) -> str:
        result = await self.container.get_blob_client(path).commit_block_list(
            block_ids,
            content_settings=ContentSettings(content_type=content_type),
            standard_blob_tier=StandardBlobTier.COOL,
            **condition,
        )
        return result["etag"]

    async def delete(self, path: str, condition: dict) -> None:
        await self.container.get_blob_client(path).delete_blob(**condition)

    async def list(self, prefix: str, marker: str | None) -> tuple[list[BlobInfo], str | None]:
        pages = self.container.list_blobs(name_starts_with=prefix, results_per_page=100).by_page(
            continuation_token=marker,
        )
        try:
            page = await anext(pages)
        except StopAsyncIteration:
            return [], None
        items = [
            BlobInfo(value.name, value.size, value.content_settings.content_type, value.etag)
            async for value in page
        ]
        return items, pages.continuation_token


async def upload(
    store: BlobStore,
    path: str,
    chunks: AsyncIterator[bytes],
    content_type: str,
    max_bytes: int,
    expected_length: int | None,
    condition: dict[str, Any],
) -> tuple[int, str]:
    block_ids: list[str] = []
    buffer = bytearray()
    total = 0
    upload_id = uuid.uuid4().bytes

    async def stage_buffer() -> None:
        block_id = base64.b64encode(upload_id + len(block_ids).to_bytes(8, "big")).decode("ascii")
        await store.stage(path, block_id, bytes(buffer))
        block_ids.append(block_id)
        buffer.clear()

    try:
        async for chunk in chunks:
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(413, "Upload exceeds MAX_UPLOAD_BYTES")
            view = memoryview(chunk)
            while view:
                take = min(BLOCK_BYTES - len(buffer), len(view))
                buffer.extend(view[:take])
                view = view[take:]
                if len(buffer) == BLOCK_BYTES:
                    await stage_buffer()
        if expected_length is not None and total != expected_length:
            raise HTTPException(400, "Content-Length does not match the received body")
        if buffer:
            await stage_buffer()
        etag = await store.commit(path, block_ids, content_type, condition)
        return total, etag
    except ClientDisconnect:
        logger.info("upload_aborted reason=client_disconnect staged_blocks=%s", len(block_ids))
        raise HTTPException(400, "Upload interrupted") from None
    finally:
        # Uncommitted blocks expire in Azure (normally seven days). Never delete or
        # commit an empty list on failure: doing so could destroy the previous blob.
        buffer.clear()
