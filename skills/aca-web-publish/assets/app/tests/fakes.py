from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass

from azure.core import MatchConditions
from azure.core.exceptions import HttpResponseError

from storage import BlobInfo

PUBLISH_TOKEN = "test-only-publisher-token-not-for-deployment-456"
PUBLISH_TOKEN_SHA256 = hashlib.sha256(PUBLISH_TOKEN.encode("utf-8")).hexdigest()


def error(status: int) -> HttpResponseError:
    exc = HttpResponseError(message="PRIVATE upstream URL or credential must never be returned")
    exc.status_code = status
    return exc


@dataclass
class Entry:
    data: bytes
    content_type: str
    etag: str


class MemoryStore:
    def __init__(self, page_size=2):
        self.entries: dict[str, Entry] = {}
        self.blocks: dict[str, dict[str, bytes]] = defaultdict(dict)
        self.calls = []
        self.page_size = page_size
        self.closed = False
        self.version = 0
        self.faults = {}

    def called(self, operation, *args):
        self.calls.append((operation, *args))
        if operation in self.faults:
            raise self.faults[operation]

    async def close(self):
        self.closed = True

    async def stat(self, path):
        self.called("stat", path)
        if path not in self.entries:
            raise error(404)
        entry = self.entries[path]
        return BlobInfo(path, len(entry.data), entry.content_type, entry.etag)

    async def download(self, path, offset, length, etag):
        self.called("download", path, offset, length, etag)
        entry = self.entries[path]
        if entry.etag != etag:
            raise error(412)
        data = entry.data[offset:offset + length]

        async def chunks():
            for start in range(0, len(data), 3):
                self.called("chunk")
                yield data[start:start + 3]
        return chunks()

    async def stage(self, path, block_id, data):
        self.called("stage", path, block_id, len(data))
        self.blocks[path][block_id] = data

    def check_condition(self, path, condition):
        match = condition.get("match_condition")
        if match == MatchConditions.IfMissing and path in self.entries:
            raise error(412)
        if match == MatchConditions.IfNotModified:
            if path not in self.entries:
                raise error(412)
            if condition["etag"] not in {"*", self.entries[path].etag}:
                raise error(412)

    async def commit(self, path, block_ids, content_type, condition):
        self.called("commit", path, block_ids, content_type, condition)
        self.check_condition(path, condition)
        data = b"".join(self.blocks[path][block_id] for block_id in block_ids)
        self.version += 1
        etag = f'"version-{self.version}"'
        self.entries[path] = Entry(data, content_type, etag)
        return etag

    async def delete(self, path, condition):
        self.called("delete", path, condition)
        self.check_condition(path, condition)
        if path not in self.entries:
            raise error(404)
        del self.entries[path]

    async def list(self, prefix, marker):
        self.called("list", prefix, marker)
        paths = sorted(path for path in self.entries if path.startswith(prefix))
        start = int(marker or "0")
        page = paths[start:start + self.page_size]
        items = [
            BlobInfo(path, len(self.entries[path].data), self.entries[path].content_type, self.entries[path].etag)
            for path in page
        ]
        next_marker = str(start + self.page_size) if start + self.page_size < len(paths) else None
        return items, next_marker


def environment(**overrides):
    values = {
        "STORAGE_ACCOUNT_NAME": "testaccount",
        "AZURE_CLIENT_ID": "11111111-1111-4111-8111-111111111111",
        "PUBLIC_BASE_URL": "https://site.example",
        "AUTH_PROVIDER": "none",
        "SESSION_SECRET": "test-only-session-secret-not-for-deployment-123",
        "UPLOAD_API_ENABLED": "true",
        "UPLOAD_API_TOKEN_SHA256": PUBLISH_TOKEN_SHA256,
        "GITHUB_CLIENT_ID": "github-test-client",
        "GITHUB_CLIENT_SECRET": "test-client-secret",
        "GOOGLE_CLIENT_ID": "google-test-client",
        "GOOGLE_CLIENT_SECRET": "test-client-secret",
        "ENTRA_TENANT_ID": "22222222-2222-4222-8222-222222222222",
        "ENTRA_CLIENT_ID": "33333333-3333-4333-8333-333333333333",
        "ENTRA_CLIENT_SECRET": "test-client-secret",
    }
    values.update(overrides)
    return values
