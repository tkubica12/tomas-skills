"""Azure Speech REST with the existing Azure CLI identity and a content cache."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
import wave
from xml.sax.saxutils import escape, quoteattr


def validate_endpoint(endpoint: str) -> str:
    parsed = urlparse(endpoint)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or not parsed.hostname.endswith(".cognitiveservices.azure.com")
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Use a custom Azure Cognitive Services HTTPS origin.")
    return endpoint.rstrip("/")


def make_ssml(text: str, voice: str, locale: str, style: str | None) -> str:
    if not text.strip():
        raise ValueError("Narration must not be empty.")
    body = escape(text)
    if style:
        body = f"<mstts:express-as style={quoteattr(style)}>{body}</mstts:express-as>"
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="http://www.w3.org/2001/mstts" '
        f"xml:lang={quoteattr(locale)}><voice name={quoteattr(voice)}>"
        f"{body}</voice></speak>"
    )


def wav_info(data: bytes) -> dict:
    with wave.open(io.BytesIO(data), "rb") as audio:
        if audio.getcomptype() != "NONE" or audio.getnframes() == 0:
            raise ValueError("Azure did not return nonempty PCM audio.")
        return {
            "seconds": audio.getnframes() / audio.getframerate(),
            "sample_rate": audio.getframerate(),
            "channels": audio.getnchannels(),
            "sample_width": audio.getsampwidth(),
        }


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Azure Speech redirected the request; credentials were not forwarded.")


class Speech:
    def __init__(
        self, endpoint: str, resource_id: str, voice: str, locale: str,
        cache: Path, style: str | None = "educational",
    ):
        self.endpoint = validate_endpoint(endpoint)
        if not resource_id.startswith("/subscriptions/"):
            raise ValueError("A complete Azure resource ID is required.")
        self.resource_id = resource_id
        self.voice = voice
        self.locale = locale
        self.style = style
        self.cache = cache
        self.cache.mkdir(parents=True, exist_ok=True)
        self._token = ""
        self._token_time = 0.0

    def _authorization(self) -> str:
        if time.monotonic() - self._token_time > 1200 or not self._token:
            cli = shutil.which("az")
            if not cli:
                raise RuntimeError("Azure CLI is required; sign in explicitly first.")
            result = subprocess.run(
                [cli, "account", "get-access-token", "--resource",
                 "https://cognitiveservices.azure.com", "-o", "json"],
                capture_output=True, text=True, check=True, timeout=60,
            )
            self._token = json.loads(result.stdout)["accessToken"]
            self._token_time = time.monotonic()
        return f"Bearer aad#{self.resource_id}#{self._token}"

    def _request(self, route: str, data: bytes | None = None) -> bytes:
        headers = {
            "Authorization": self._authorization(),
            "User-Agent": "explanatory-video/1",
        }
        if data is not None:
            headers.update({
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
            })
        for attempt in range(3):
            request = Request(self.endpoint + route, data=data, headers=headers)
            try:
                with build_opener(NoRedirect()).open(request, timeout=180) as response:
                    return response.read()
            except HTTPError as error:
                detail = error.read(1200).decode("utf-8", errors="replace")
                if error.code not in (429, 502, 503, 504) or attempt == 2:
                    raise RuntimeError(
                        f"Azure Speech HTTP {error.code}: {detail}"
                    ) from error
                retry = error.headers.get("Retry-After", "")
                delay = min(float(retry), 60) if retry.isdigit() else 2 ** (attempt + 1)
                print(f"Azure Speech HTTP {error.code}; retrying in {delay}s.", flush=True)
                time.sleep(delay)
        raise RuntimeError("Speech retries exhausted.")

    def voices(self) -> list[dict]:
        return json.loads(self._request("/tts/cognitiveservices/voices/list"))

    def synthesize(self, text: str) -> tuple[Path, dict]:
        ssml = make_ssml(text, self.voice, self.locale, self.style)
        config = {
            "ssml": ssml,
            "endpoint": self.endpoint,
            "resource_id": self.resource_id,
            "format": "riff-24khz-16bit-mono-pcm",
        }
        key = hashlib.sha256(
            json.dumps(config, sort_keys=True).encode("utf-8")
        ).hexdigest()
        path = self.cache / f"{key}.wav"
        if path.exists():
            info = wav_info(path.read_bytes())
        else:
            audio = self._request("/tts/cognitiveservices/v1", ssml.encode("utf-8"))
            info = wav_info(audio)
            partial = path.with_suffix(".part")
            partial.write_bytes(audio)
            os.replace(partial, path)
        provenance = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "voice": self.voice,
            "locale": self.locale,
            "style": self.style,
            "synthetic": True,
            "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            **info,
        }
        path.with_suffix(".json").write_text(
            json.dumps(provenance, indent=2), encoding="utf-8"
        )
        return path, provenance


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--resource-id", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--locale", required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--style", default="educational")
    parser.add_argument("--text-file", type=Path)
    parser.add_argument("--list-voices", action="store_true")
    args = parser.parse_args()
    client = Speech(
        args.endpoint, args.resource_id, args.voice, args.locale,
        args.cache, args.style or None,
    )
    if args.list_voices:
        print(json.dumps(
            [voice for voice in client.voices() if voice.get("Locale") == args.locale],
            ensure_ascii=True, indent=2,
        ))
    elif args.text_file:
        path, info = client.synthesize(args.text_file.read_text(encoding="utf-8"))
        print(json.dumps({"path": str(path), **info}, indent=2))
    else:
        parser.error("Choose --list-voices or --text-file.")


if __name__ == "__main__":
    main()
