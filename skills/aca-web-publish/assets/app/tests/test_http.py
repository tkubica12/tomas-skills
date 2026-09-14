from __future__ import annotations

import socket
import threading
import time
import unittest

import httpx
import uvicorn

from app import create_app
from config import Settings
from tests.fakes import MemoryStore, PUBLISH_TOKEN, environment


class LocalHTTPTests(unittest.TestCase):
    def test_real_uvicorn_socket_crud_ranges_and_chunked_limit(self):
        self.check_http_roundtrip(bootstrap=False)

    def test_real_uvicorn_bootstrap_without_public_origin(self):
        self.check_http_roundtrip(bootstrap=True)

    def check_http_roundtrip(self, *, bootstrap):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        origin = f"http://127.0.0.1:{port}"
        settings = Settings.from_env(environment(
            PUBLIC_BASE_URL="" if bootstrap else origin,
            LOCAL_DEV="false" if bootstrap else "true", MAX_UPLOAD_BYTES="10",
        ))
        store = MemoryStore()
        application = create_app(settings, lambda _: store)
        server = uvicorn.Server(uvicorn.Config(
            application, host="127.0.0.1", port=port, access_log=False, log_level="error",
        ))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 15
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(server.started, "Local uvicorn must start and remain responsive")
            with httpx.Client(base_url=origin, timeout=5, trust_env=False) as client:
                self.assertEqual(client.get("/healthz").json(), {"status": "ok"})
                self.assertEqual(client.get("/_publish/blobs").status_code, 401)
                key = {"Authorization": "Bearer " + PUBLISH_TOKEN}
                path = "/_publish/blobs/index.html"
                self.assertEqual(client.put(path, headers=key | {"Content-Type": "text/html"}, content=b"0123456789").status_code, 200)
                self.assertEqual(client.get("/").content, b"0123456789")
                self.assertEqual(client.head("/").headers["content-length"], "10")
                response = client.get("/", headers={"Range": "bytes=3-5"})
                self.assertEqual(response.status_code, 206)
                self.assertEqual(response.content, b"345")
                self.assertEqual(client.get("/_publish/blobs", headers=key).json()["items"][0]["path"], "index.html")
                self.assertEqual(client.put(path, headers=key, content=b"changed").status_code, 200)
                self.assertEqual(client.get("/").content, b"changed")

                def chunked():
                    yield b"12345"
                    yield b"67890"
                    yield b"x"
                response = client.put("/_publish/blobs/oversize.bin", headers=key, content=chunked())
                self.assertEqual(response.status_code, 413)
                self.assertNotIn("oversize.bin", store.entries)
                self.assertEqual(client.delete(path, headers=key).status_code, 204)
                self.assertEqual(client.get("/").status_code, 404)
        finally:
            server.should_exit = True
            thread.join(timeout=10)
            sock.close()
        self.assertFalse(thread.is_alive(), "The local HTTP test must stop its own server")
        self.assertTrue(store.closed)


if __name__ == "__main__":
    unittest.main()
