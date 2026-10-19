"""Render an authored, audio-timed explanatory score. See production.md."""

from __future__ import annotations

import argparse
import functools
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import textwrap
import wave

from PIL import Image, ImageDraw, ImageFont

from azure_tts import Speech

BASE = (1280, 720)
BG = "#101820"
INK = "#edf2f4"
MUTED = "#a9bdc8"
ANTIALIAS_SCALE = 2


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def run(command: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")


def lerp(value: object, cue: float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, list) or not value:
        raise ValueError(f"Invalid keyframe track: {value!r}")
    if cue <= value[0][0]:
        return float(value[0][1])
    for (start, a), (end, b) in zip(value, value[1:]):
        if end <= start:
            raise ValueError("Keyframe times must strictly increase.")
        if cue <= end:
            t = (cue - start) / (end - start)
            t = t * t * (3 - 2 * t)
            return a + (b - a) * t
    return float(value[-1][1])


def cue_at(seconds: float, units: list[dict]) -> float:
    for index, unit in enumerate(units):
        if seconds < unit["end"]:
            span = unit["speech_end"] - unit["start"]
            fraction = max(0, seconds - unit["start"]) / span
            return min(index + fraction, math.nextafter(float(index + 1), -math.inf))
    return float(len(units))


def time_at(cue: float, units: list[dict]) -> float:
    if cue >= len(units):
        return units[-1]["end"]
    index = max(0, math.floor(cue))
    unit = units[index]
    return unit["start"] + (cue - index) * (unit["speech_end"] - unit["start"])


def validate_score(score: dict) -> None:
    if not isinstance(score.get("title"), str) or not score["title"].strip():
        raise ValueError("The score needs a nonempty title.")
    if not isinstance(score.get("shots"), list) or not score["shots"]:
        raise ValueError("The score needs at least one shot.")
    if not re.fullmatch(r"[a-z]{3}", score.get("subtitle_language", "und")):
        raise ValueError("subtitle_language must be an ISO 639-2 three-letter code.")
    seen = set()
    reserved = {"CON", "PRN", "AUX", "NUL"}
    reserved.update(f"{prefix}{n}" for prefix in ("COM", "LPT") for n in range(1, 10))
    for shot in score["shots"]:
        ident = shot.get("id", "")
        if (not isinstance(ident, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", ident)
                or ident.upper() in reserved or ident.casefold() in seen):
            raise ValueError(f"Shot IDs must be unique, filesystem-safe names: {ident!r}")
        seen.add(ident.casefold())
        for field in ("heading", "chapter"):
            if not isinstance(shot.get(field), str) or not shot[field].strip():
                raise ValueError(f"{ident}: nonempty {field} is required.")
        if shot.get("layout", "standard") not in ("standard", "title"):
            raise ValueError(f"{ident}: layout must be standard or title.")
        units = shot.get("sentences")
        if not isinstance(units, list) or not units:
            raise ValueError(f"{ident}: narration units are required.")
        for unit in units:
            if not isinstance(unit, (str, dict)):
                raise ValueError(f"{ident}: a narration unit must be text or an object.")
            text = unit if isinstance(unit, str) else unit.get("text", "")
            pause = .23 if isinstance(unit, str) else unit.get("pause_after", .23)
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"{ident}: empty narration.")
            if not isinstance(pause, (int, float)) or not math.isfinite(pause) or pause < 0:
                raise ValueError(f"{ident}: pause_after must be finite and nonnegative.")
        if not isinstance(shot.get("elements"), list):
            raise ValueError(f"{ident}: elements must be a list.")
        element_ids = set()
        for element in shot["elements"]:
            name = element.get("id")
            if not isinstance(name, str) or not name or name in element_ids:
                raise ValueError(f"{ident}: elements need unique persistent IDs.")
            element_ids.add(name)
            if element.get("type") not in ("text", "rect", "circle", "line", "polyline"):
                raise ValueError(f"{ident}: unsupported element type.")
            if element["type"] == "polyline" and element.get("arrow"):
                raise ValueError(f"{ident}: polyline arrows are unsupported; use a final line with arrow:true.")
            show = element.get("show", [0, len(units) + 1])
            if (not isinstance(show, list) or len(show) != 2
                    or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in show)
                    or show[1] <= show[0]):
                raise ValueError(f"{ident}/{name}: invalid visibility interval.")
            for key in ("x", "y", "w", "h", "x2", "y2", "r", "stroke", "progress"):
                track = element.get(key, 0)
                if isinstance(track, (int, float)) and math.isfinite(track):
                    continue
                if (not isinstance(track, list) or not track
                        or any(not isinstance(p, list) or len(p) != 2
                               or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in p)
                               for p in track)
                        or any(b[0] <= a[0] for a, b in zip(track, track[1:]))):
                    raise ValueError(f"{ident}/{name}: invalid {key} keyframes.")
        for key, default in (("heading_show", 0), ("takeaway_show", 2)):
            value = shot.get(key, default)
            if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError(f"{ident}: {key} must be a nonnegative cue.")
        for prediction in shot.get("predictions", []):
            index = prediction["unit"]
            if not isinstance(index, int) or not 0 <= index < len(units):
                raise ValueError(f"{ident}: invalid prediction unit.")
            for surface in prediction.get("answer_surfaces", []):
                if surface == "heading":
                    if shot.get("layout", "standard") == "title":
                        continue
                    reveal = shot.get("heading_show", 0)
                elif surface == "takeaway":
                    continue
                else:
                    matches = [e for e in shot["elements"] if e["id"] == surface]
                    if not matches:
                        raise ValueError(f"{ident}: unknown answer surface {surface!r}.")
                    reveal = matches[0].get("show", [0])[0]
                if reveal < index + 1:
                    raise ValueError(f"{ident}: answer {surface!r} precedes the prediction pause.")


def rgb(color: str) -> tuple[int, int, int]:
    if len(color) != 7 or not color.startswith("#"):
        raise ValueError(f"Use #RRGGBB colors, got {color!r}.")
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def font_path() -> str:
    for candidate in (
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/Library/Fonts/Arial.ttf"),
    ):
        if candidate.exists():
            return str(candidate)
    raise RuntimeError("No supported font found. Supply --font with Czech glyphs.")


class Renderer:
    def __init__(self, width: int, height: int, font: str):
        if width <= 0 or height <= 0 or width * 9 != height * 16 or width % 2 or height % 2:
            raise ValueError("Use an even 16:9 output size.")
        self.width, self.height = width, height
        self.scale = width / BASE[0]
        self.raster_scale = self.scale * ANTIALIAS_SCALE
        self.raster_size = (width * ANTIALIAS_SCALE, height * ANTIALIAS_SCALE)
        self.font = font
        self.font_sha256 = hashlib.sha256(Path(font).read_bytes()).hexdigest()
        self.bounds: dict[str, tuple[float, float, float, float]] = {}
        self._last_signature = None
        self._last_image = None
        self._last_bounds = {}

    @functools.lru_cache(maxsize=4096)
    def label(self, text: str, size: int, color: str, max_width: int) -> Image.Image:
        font = ImageFont.truetype(self.font, round(size * self.raster_scale))
        if max_width:
            words = text.split()
            lines, line = [], ""
            for word in words:
                candidate = f"{line} {word}".strip()
                if font.getlength(candidate) > max_width * self.raster_scale and line:
                    lines.append(line)
                    line = word
                else:
                    line = candidate
            lines.append(line)
            text = "\n".join(lines)
        box = font.getbbox(text) if "\n" not in text else None
        draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        box = draw.multiline_textbbox((0, 0), text, font=font, spacing=round(size * self.raster_scale * .18))
        image = Image.new("RGBA", (max(1, box[2] - box[0] + 4), max(1, box[3] - box[1] + 4)))
        ImageDraw.Draw(image).multiline_text(
            (2 - box[0], 2 - box[1]), text, font=font, fill=color,
            spacing=round(size * self.raster_scale * .18),
        )
        return image.resize(
            (math.ceil(image.width / ANTIALIAS_SCALE), math.ceil(image.height / ANTIALIAS_SCALE)),
            Image.Resampling.LANCZOS,
        )

    @functools.lru_cache(maxsize=128)
    def shape(self, kind: str, track: tuple, color: str, fill: str | None,
              corner: float, arrow: bool, points: tuple) -> tuple[Image.Image, tuple[int, int]]:
        x, y, w, h, x2, y2, radius, stroke, progress = (n * self.scale for n in track)
        progress = track[-1]
        if kind == "line":
            x2, y2 = x + (x2-x)*progress, y + (y2-y)*progress
            extent = (min(x, x2), min(y, y2), max(x, x2), max(y, y2))
        elif kind == "circle":
            extent = (x-radius, y-radius, x+radius, y+radius)
        elif kind == "rect":
            extent = (x, y, x+w, y+h)
        elif kind == "polyline":
            points = tuple((px*self.scale, py*self.scale) for px, py in points)
            extent = (min(p[0] for p in points), min(p[1] for p in points),
                      max(p[0] for p in points), max(p[1] for p in points))
        else:
            raise ValueError(f"Unknown shape type: {kind}")
        head_length = max(11*self.scale, 2.5*stroke)
        padding = max(stroke / 2, .45*head_length if arrow else 0) + 4
        left, top = math.floor(extent[0]-padding), math.floor(extent[1]-padding)
        right, bottom = math.ceil(extent[2]+padding), math.ceil(extent[3]+padding)
        aa = ANTIALIAS_SCALE
        tile = Image.new("RGBA", ((right-left)*aa, (bottom-top)*aa))
        draw = ImageDraw.Draw(tile)

        def point(px, py):
            return ((px-left)*aa, (py-top)*aa)

        weight = max(1, round(stroke*aa))

        def cap(px, py):
            cx, cy = point(px, py)
            r = weight / 2
            draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color)

        if kind == "rect":
            draw.rounded_rectangle(
                (*point(x, y), *point(x+w, y+h)), radius=corner*self.scale*aa,
                fill=fill, outline=color, width=weight,
            )
        elif kind == "circle":
            draw.ellipse((*point(x-radius, y-radius), *point(x+radius, y+radius)),
                         fill=fill, outline=color, width=weight)
        elif kind == "line":
            distance = math.hypot(x2-x, y2-y)
            shaft_x, shaft_y = x2, y2
            head = arrow and progress > .02 and distance > 0
            if head:
                angle = math.atan2(y2-y, x2-x)
                length = min(head_length, distance)
                shaft_x, shaft_y = x2-length*math.cos(angle), y2-length*math.sin(angle)
                draw.polygon([
                    point(x2, y2),
                    point(shaft_x-length*.45*math.sin(angle), shaft_y+length*.45*math.cos(angle)),
                    point(shaft_x+length*.45*math.sin(angle), shaft_y-length*.45*math.cos(angle)),
                ], fill=color)
            if distance > 0 and (not head or distance > head_length):
                draw.line((*point(x, y), *point(shaft_x, shaft_y)), fill=color, width=weight)
                cap(x, y)
                cap(shaft_x, shaft_y)
        elif kind == "polyline":
            draw.line([point(px, py) for px, py in points], fill=color, width=weight, joint="curve")
            for px, py in points:
                cap(px, py)
        return tile.resize((right-left, bottom-top), Image.Resampling.LANCZOS), (left, top)

    def frame(self, shot: dict, cue: float, progress: float, chapter: str) -> Image.Image:
        active = []
        for index, element in enumerate(shot["elements"]):
            show = element.get("show", [-100, 10000])
            if not show[0] <= cue < show[1]:
                continue
            values = {key: lerp(element.get(key, default), cue) for key, default in (
                ("x", 0), ("y", 0), ("w", 0), ("h", 0),
                ("x2", 0), ("y2", 0), ("r", 10), ("stroke", 2), ("progress", 1),
            )}
            active.append((index, element, values))
        signature = (
            json.dumps(shot, sort_keys=True), chapter, cue >= shot.get("heading_show", 0),
            tuple((index, tuple(values.values())) for index, _, values in active),
        )
        if signature == self._last_signature:
            self.bounds = dict(self._last_bounds)
            return self._last_image.copy()
        self.bounds.clear()
        image = Image.new("RGB", (self.width, self.height), shot.get("background", BG))
        draw = ImageDraw.Draw(image)
        s = self.scale

        def text(x: float, y: float, content: str, size: int, color: str,
                 width: int = 0, center: bool = False, ident: str = "") -> None:
            label = self.label(content, size, color, width)
            px = round(x * s - (label.width / 2 if center else 0))
            py = round(y * s)
            if ident:
                bounds = (px / s, py / s, (px + label.width) / s, (py + label.height) / s)
                self.bounds[ident] = bounds
                if px < 0 or py < 0 or px + label.width > image.width or py + label.height > image.height:
                    raise ValueError(f"Clipped text {ident!r}: {content!r}, {bounds}")
            image.paste(label, (px, py), label)

        if shot.get("layout", "standard") == "standard":
            text(56, 30, chapter.upper(), 17, "#79d4c2", ident="chapter")
            if cue >= shot.get("heading_show", 0):
                text(56, 68, shot["heading"], 37, INK, 1150, ident="heading")
            draw.line((56*s, 130*s, 1224*s, 130*s), fill="#2b3c48", width=max(1, round(s)))
        for _, element, values in active:
            kind = element["type"]
            color = element.get("color", INK)
            if kind == "text":
                text(values["x"], values["y"], element["text"], element.get("size", 24),
                     color, element.get("width", 0), element.get("center", False),
                     element.get("id", element["text"]))
            else:
                tile, position = self.shape(
                    kind, tuple(values.values()), color,
                    element.get("fill", color if kind == "circle" else None),
                    element.get("radius", 12), element.get("arrow", False),
                    tuple(tuple(p) for p in element.get("points", [])),
                )
                image.paste(tile, position, tile)
        self._last_signature = signature
        self._last_image = image.copy()
        self._last_bounds = dict(self.bounds)
        return image


def pad_pcm(seconds: float, rate: int) -> bytes:
    return b"\0\0" * round(seconds * rate)


def prepare(score: dict, speech: Speech, output: Path, fps: int) -> dict:
    work = output / "work"
    work.mkdir(parents=True, exist_ok=True)
    timeline, absolute = [], 0.0
    for shot in score["shots"]:
        print(f"Speech {shot['id']}: {shot['heading']}", flush=True)
        pcm = bytearray()
        units = []
        for index, sentence in enumerate(shot["sentences"]):
            content = sentence if isinstance(sentence, str) else sentence["text"]
            pause = .23 if isinstance(sentence, str) else sentence.get("pause_after", .23)
            path, info = speech.synthesize(content)
            if (info["sample_rate"], info["channels"], info["sample_width"]) != (24000, 1, 2):
                raise ValueError("Expected 24kHz mono 16-bit PCM.")
            start = len(pcm) / 48000
            with wave.open(str(path), "rb") as audio:
                pcm.extend(audio.readframes(audio.getnframes()))
            speech_end = len(pcm) / 48000
            pcm.extend(pad_pcm(pause, 24000))
            units.append({
                "text": content, "start": start, "speech_end": speech_end,
                "end": len(pcm)/48000, "source": path.name, **info,
            })
        pcm.extend(pad_pcm(.35, 24000))
        frames = math.ceil(len(pcm) / 48000 * fps)
        target_samples = round(frames / fps * 24000)
        pcm.extend(b"\0\0" * (target_samples - len(pcm)//2))
        audio_path = work / f"{shot['id']}.wav"
        with wave.open(str(audio_path), "wb") as audio:
            audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
            audio.writeframes(pcm)
        duration = frames / fps
        timeline.append({
            "id": shot["id"], "start": absolute, "duration": duration,
            "frames": frames, "units": units, "audio": str(audio_path),
        })
        absolute += duration
    manifest = {
        "title": score["title"], "fps": fps, "duration": absolute,
        "voice": speech.voice, "locale": speech.locale, "synthetic_narration": True,
        "score_sha256": hashlib.sha256(
            json.dumps(score, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest(), "shots": timeline,
    }
    write_json(output / "timeline.json", manifest)
    return manifest


def timestamp(seconds: float, separator: str = ",") -> str:
    millis = round(seconds * 1000)
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{separator}{millis:03}"


def metadata_text(value: str) -> str:
    return "".join("\\" + char if char in "\\=;#\n" else char for char in value)


def captions(score: dict, timeline: dict, output: Path) -> None:
    srt, transcript, chapters = [], [], []
    previous = None
    count = 0
    for shot, timing in zip(score["shots"], timeline["shots"], strict=True):
        if shot["chapter"] != previous:
            chapters.append({"title": shot["chapter"], "start": timing["start"]})
            transcript.append(f"\n## {shot['chapter']}\n")
            previous = shot["chapter"]
        transcript.append(f"\n[{timestamp(timing['start'], '.').split('.')[0]}] {shot['heading']}\n")
        for unit in timing["units"]:
            count += 1
            srt.append(
                f"{count}\n{timestamp(timing['start']+unit['start'])} --> "
                f"{timestamp(timing['start']+unit['speech_end'])}\n"
                + "\n".join(textwrap.wrap(unit["text"], width=62)) + "\n"
            )
            transcript.append(unit["text"])
    (output / "captions.srt").write_text("\n".join(srt), encoding="utf-8")
    (output / "transcript.md").write_text(
        f"# {score['title']}\n\nSynthetic narration: {timeline['voice']}\n"
        + "\n".join(transcript), encoding="utf-8",
    )
    write_json(output / "chapters.json", chapters)
    metadata = [";FFMETADATA1", f"title={metadata_text(score['title'])}",
                "comment=Synthetic narration; original illustrative animations"]
    for index, chapter in enumerate(chapters):
        end = chapters[index+1]["start"] if index+1 < len(chapters) else timeline["duration"]
        metadata.extend([
            "[CHAPTER]", "TIMEBASE=1/1000", f"START={round(chapter['start']*1000)}",
            f"END={round(end*1000)}", f"title={metadata_text(chapter['title'])}",
        ])
    (output / "chapters.ffmeta").write_text("\n".join(metadata), encoding="utf-8")


def render_digest(shot: dict, timing: dict, renderer: Renderer, total_duration: float) -> str:
    return hashlib.sha256(json.dumps({
        "shot": shot, "timing": timing, "total_duration": total_duration,
        "audio_sha256": hashlib.sha256(Path(timing["audio"]).read_bytes()).hexdigest(),
        "width": renderer.width, "height": renderer.height, "font": renderer.font,
        "font_sha256": renderer.font_sha256,
        "raster_size": renderer.raster_size,
        "engine": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }, sort_keys=True).encode()).hexdigest()


def render(score: dict, timeline: dict, output: Path, renderer: Renderer,
           fps: int, only: str | None = None) -> None:
    for shot, timing in zip(score["shots"], timeline["shots"], strict=True):
        if only and shot["id"] != only:
            continue
        path = output / "work" / f"{shot['id']}.mp4"
        digest = render_digest(shot, timing, renderer, timeline["duration"])
        stamp = path.with_suffix(".sha256")
        if path.exists() and stamp.exists() and stamp.read_text() == digest:
            print(f"Cached render {shot['id']}", flush=True)
            continue
        print(f"Render {shot['id']}: {timing['duration']:.1f}s", flush=True)
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size",
            f"{renderer.width}x{renderer.height}", "-framerate", str(fps),
            "-i", "pipe:0", "-i", timing["audio"],
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
            "-threads", "4", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
            "-ar", "48000", "-t", str(timing["duration"]), "-movflags", "+faststart",
            str(path),
        ]
        error_path = path.with_suffix(".stderr")
        with error_path.open("wb") as error_log:
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=error_log)
            try:
                for frame in range(timing["frames"]):
                    seconds = frame / fps
                    image = renderer.frame(
                        shot, cue_at(seconds, timing["units"]),
                        (timing["start"]+seconds)/timeline["duration"], shot["chapter"],
                    )
                    process.stdin.write(image.tobytes())
                process.stdin.close()
                return_code = process.wait(timeout=120)
                if return_code:
                    raise RuntimeError(error_path.read_text(errors="replace"))
            except BaseException:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=30)
                raise
        error_path.unlink()
        stamp.write_text(digest)


def assemble(score: dict, timeline: dict, output: Path, renderer: Renderer) -> None:
    paths = [output / "work" / f"{shot['id']}.mp4" for shot in score["shots"]]
    if any(not path.exists() for path in paths):
        raise RuntimeError("Not all shot renders exist.")
    for shot, timing, path in zip(score["shots"], timeline["shots"], paths, strict=True):
        stamp = path.with_suffix(".sha256")
        if not stamp.exists() or stamp.read_text() != render_digest(shot, timing, renderer, timeline["duration"]):
            raise RuntimeError(f"Stale render {shot['id']}; run render before assembling.")
    # Concat paths are controlled output filenames; apostrophes must still be escaped.
    concat = "\n".join(
        "file '" + str(path.resolve()).replace("\\", "/").replace("'", "'\\''") + "'"
        for path in paths
    )
    listing = output / "work" / "concat.txt"
    listing.write_text(concat, encoding="utf-8")
    joined = output / "work" / "joined.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
         "-safe", "0", "-i", str(listing), "-c", "copy", str(joined)])
    analysis = run([
        "ffmpeg", "-hide_banner", "-i", str(joined), "-vn", "-af",
        "loudnorm=I=-16:TP=-3:LRA=9:print_format=json", "-f", "null", "-",
    ])
    stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
    if stats["input_i"] == "-inf":
        raise RuntimeError("Narration is silent.")
    peak_target, offset = -3.0, float(stats["target_offset"])
    attempts = []
    for _ in range(4):
        loudness = (
            f"loudnorm=I=-16:TP={peak_target}:LRA=9:"
            f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
            f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
            f"offset={offset}:linear=true:print_format=json"
        )
        result = run([
            "ffmpeg", "-hide_banner", "-y", "-i", str(joined), "-i",
            str(output / "chapters.ffmeta"), "-i", str(output / "captions.srt"),
            "-map", "0:v:0", "-map", "0:a:0", "-map", "2:0", "-map_metadata", "1",
            "-map_chapters", "1", "-c:v", "copy", "-af",
            f"{loudness},atrim=duration={timeline['duration']}",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-c:s", "mov_text", "-metadata:s:s:0", f"language={score.get('subtitle_language', 'und')}",
            "-movflags", "+faststart", str(output / "video.mp4"),
        ])
        measured = run([
            "ffmpeg", "-hide_banner", "-i", str(output / "video.mp4"), "-vn", "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-",
        ])
        encoded, _ = json.JSONDecoder().raw_decode(measured.stderr[measured.stderr.rfind("{"):])
        normalization, _ = json.JSONDecoder().raw_decode(result.stderr[result.stderr.rfind("{"):])
        attempts.append({"peak_target": peak_target, "offset": offset, "encoded": encoded})
        integrated, peak = float(encoded["input_i"]), float(encoded["input_tp"])
        passed = math.isfinite(integrated) and math.isfinite(peak) and abs(integrated+16) <= .5 and peak <= -1.5
        write_json(output / "loudness.json", {
            "before": stats, "normalization": normalization, "encoded": encoded,
            "attempts": attempts, "passed": passed,
        })
        if not math.isfinite(integrated) or not math.isfinite(peak):
            raise RuntimeError("Encoded narration is silent or has invalid loudness.")
        if passed:
            break
        # AAC changes peaks; correct from the encoded file, not filter promises.
        correction = -16-integrated
        response = "unit-gain initial correction"
        if len(attempts) > 1:
            previous = attempts[-2]
            delta_offset = offset-previous["offset"]
            delta_loudness = integrated-float(previous["encoded"]["input_i"])
            if previous["peak_target"] == peak_target and delta_offset*delta_loudness > 0:
                multiplier = min(4.0, max(.5, delta_offset/delta_loudness))
                correction *= multiplier
                response = f"bounded measured secant multiplier {multiplier:.6g}"
        attempts[-1].update(next_offset_correction=correction, response_model=response)
        offset += correction
        if peak > -1.5:
            peak_target -= peak+1.5+.2
    else:
        raise RuntimeError("Encoded audio misses loudness/true-peak limits after four attempts; see loudness.json.")
    probe = json.loads(run([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-show_chapters",
        "-of", "json", str(output / "video.mp4"),
    ]).stdout)
    write_json(output / "ffprobe.json", probe)


def snapshots(score: dict, timeline: dict, output: Path, renderer: Renderer) -> None:
    target = output / "frames"
    target.mkdir(exist_ok=True)
    manifest = []
    for shot, timing in zip(score["shots"], timeline["shots"], strict=True):
        samples = {}
        for index, unit in enumerate(timing["units"]):
            for suffix, fraction in (("before", .03), ("during", .5), ("after", .96)):
                seconds = unit["start"] + fraction * (unit["speech_end"]-unit["start"])
                samples[f"{index}-{suffix}"] = seconds
            if unit["end"] - unit["speech_end"] > .5:
                samples[f"{index}-pause-start"] = unit["speech_end"] + .02
                samples[f"{index}-pause-end"] = unit["end"] - .02
        cues = {float(shot.get("takeaway_show", 2)), float(shot.get("heading_show", 0))}
        for element in shot["elements"]:
            cues.update(element.get("show", []))
            for value in element.values():
                if (isinstance(value, list) and value and isinstance(value[0], list)
                        and len(value[0]) == 2 and element["type"] != "polyline"):
                    cues.update(point[0] for point in value)
        for cue in sorted(c for c in cues if 0 <= c <= len(timing["units"])):
            seconds = time_at(cue, timing["units"])
            for label, offset in (("before", -1/timeline["fps"]), ("at", 0), ("after", 1/timeline["fps"])):
                samples[f"cue-{cue:.4f}-{label}"] = max(0, min(timing["duration"]-1/timeline["fps"], seconds+offset))
        for label, seconds in samples.items():
            path = target / f"{shot['id']}-{label}.png"
            renderer.frame(shot, cue_at(seconds, timing["units"]),
                           (timing["start"]+seconds)/timeline["duration"],
                           shot["chapter"]).save(path)
            manifest.append({"shot": shot["id"], "time": timing["start"]+seconds,
                             "cue": cue_at(seconds, timing["units"]), "file": path.name,
                             "text_bounds": dict(renderer.bounds)})
    write_json(output / "frame-index.json", manifest)
    write_json(output / "text-bounds.json", renderer.bounds)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["prepare", "render", "assemble", "snapshots", "all"])
    parser.add_argument("--score", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--azure", type=Path)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--font")
    parser.add_argument("--only")
    args = parser.parse_args()
    if args.fps <= 0:
        parser.error("--fps must be positive.")
    for program in ("ffmpeg", "ffprobe"):
        if not shutil.which(program):
            parser.error(f"{program} is required.")
    score = read_json(args.score)
    validate_score(score)
    if args.only and args.only not in {shot["id"] for shot in score["shots"]}:
        parser.error("--only must identify an existing shot.")
    args.output.mkdir(parents=True, exist_ok=True)
    if args.mode in ("prepare", "all"):
        if not args.azure:
            parser.error("--azure job-local configuration is required for synthesis.")
        config = read_json(args.azure)
        if score.get("language", config["locale"]) != config["locale"]:
            parser.error("The score language and configured speech locale must agree.")
        speech = Speech(cache=Path(config.pop("cache")), **config)
        manifest = prepare(score, speech, args.output, args.fps)
    else:
        manifest = read_json(args.output / "timeline.json")
        if manifest["fps"] != args.fps:
            parser.error("Use the same FPS as the prepared timeline.")
        digest = hashlib.sha256(json.dumps(score, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
        if digest != manifest["score_sha256"]:
            parser.error("The score changed. Run prepare again to refresh timing and cached speech.")
    captions(score, manifest, args.output)
    renderer = Renderer(args.width, args.height, args.font or font_path())
    if args.mode in ("render", "all"):
        render(score, manifest, args.output, renderer, args.fps, args.only)
    if args.mode in ("snapshots", "all"):
        snapshots(score, manifest, args.output, renderer)
    if args.mode in ("assemble", "all"):
        assemble(score, manifest, args.output, renderer)


if __name__ == "__main__":
    main()
