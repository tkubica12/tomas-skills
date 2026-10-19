"""Small offline regressions; no Azure requests, installs or external services."""

import io
import copy
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import wave

from azure_tts import NoRedirect, make_ssml, validate_endpoint, wav_info
from film import (BG, Renderer, assemble, captions, cue_at, font_path, lerp, prepare,
                  read_json, render, render_digest, run, time_at, timestamp, validate_score)


class SpeechTests(unittest.TestCase):
    def test_escapes_text_and_attributes(self):
        value = make_ssml('A & B < C', 'voice"x', 'cs-CZ', 'educational')
        self.assertIn("A &amp; B &lt; C", value)
        self.assertIn("voice'x", value.replace('"', "'"))
        from xml.etree import ElementTree
        ElementTree.fromstring(value)

    def test_rejects_non_azure_and_embedded_credentials(self):
        for endpoint in (
            "https://evil.example", "http://x.cognitiveservices.azure.com",
            "https://x.cognitiveservices.azure.com.evil.example",
            "https://user:secret@x.cognitiveservices.azure.com",
            "https://x.cognitiveservices.azure.com/path",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                validate_endpoint(endpoint)

    def test_empty_speech_is_explicit_error(self):
        with self.assertRaises(ValueError):
            make_ssml(" ", "voice", "en-US", None)

    def test_valid_wav_measures_samples(self):
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
            audio.writeframes(b"\0\0" * 12000)
        self.assertEqual(wav_info(output.getvalue())["seconds"], .5)

    def test_redirect_never_forwards_credentials(self):
        with self.assertRaisesRegex(RuntimeError, "not forwarded"):
            NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.org")


class TimingTests(unittest.TestCase):
    def test_interpolation_and_boundaries(self):
        self.assertEqual(lerp([[0, 10], [1, 30]], -.1), 10)
        self.assertEqual(lerp([[0, 10], [1, 30]], .5), 20)
        self.assertEqual(lerp([[0, 10], [1, 30]], 2), 30)
        self.assertEqual(cue_at(1, [{"start": 0, "speech_end": 2, "end": 2}]), .5)
        self.assertEqual(cue_at(2, [{"start": 0, "speech_end": 2, "end": 2}]), 1)

    def test_prediction_pause_freezes_before_next_reveal(self):
        units = [{"start": 0, "speech_end": 2, "end": 4},
                 {"start": 4, "speech_end": 8, "end": 8.23}]
        self.assertEqual(cue_at(2.1, units), cue_at(3.9, units))
        self.assertLess(cue_at(3.9, units), 1)
        self.assertEqual(cue_at(4, units), 1)
        self.assertEqual(time_at(.5, units), 1)
        self.assertEqual(time_at(1, units), 4)

    def test_timestamp_rounds_without_invalid_milliseconds(self):
        self.assertEqual(timestamp(59.9996), "00:01:00,000")
        self.assertEqual(timestamp(3600.123), "01:00:00,123")

    def test_caption_ends_at_speech_not_thinking_pause(self):
        score = {"title": "Test", "shots": [
            {"chapter": "One", "heading": "Why", "sentences": ["Question?"]},
        ]}
        timeline = {"voice": "test", "duration": 5, "shots": [
            {"start": 0, "units": [{"text": "Question?", "start": 0,
                                  "speech_end": 2, "end": 5}]},
        ]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            captions(score, timeline, path)
            self.assertIn("00:00:02,000", (path / "captions.srt").read_text())


class ScoreTests(unittest.TestCase):
    def setUp(self):
        self.shot = {"id": "scene-1", "heading": "Why?", "chapter": "Test",
                     "sentences": [{"text": "Predict.", "pause_after": 2}, "Reveal."],
                     "elements": []}
        self.score = {"title": "An unrelated example", "shots": [self.shot]}

    def test_accepts_english_and_arbitrary_unit_count(self):
        self.shot["sentences"].append("Another inference.")
        self.score["subtitle_language"] = "eng"
        validate_score(self.score)

    def test_rejects_unsafe_reserved_and_duplicate_filenames(self):
        for ident in ("..", "..\\escape", "a/b", "CON", "com1", ""):
            with self.subTest(ident=ident), self.assertRaises(ValueError):
                self.shot["id"] = ident
                validate_score(self.score)
        self.shot["id"] = "ok"
        self.score["shots"].append(dict(self.shot))
        self.score["shots"][1]["id"] = "OK"
        with self.assertRaises(ValueError):
            validate_score(self.score)

    def test_answer_cannot_appear_before_pause_finishes(self):
        self.shot["elements"] = [{
            "id": "answer", "type": "text", "text": "Answer", "show": [.5, 9],
        }]
        self.shot["predictions"] = [{"unit": 0, "answer_surfaces": ["answer"]}]
        with self.assertRaisesRegex(ValueError, "precedes"):
            validate_score(self.score)
        self.shot["elements"][0]["show"][0] = 1
        validate_score(self.score)

    def test_hidden_metadata_is_not_a_visible_answer(self):
        self.shot.update(layout="title", takeaway_show=0, heading_show=0)
        self.shot["predictions"] = [{"unit": 0, "answer_surfaces": ["takeaway", "heading"]}]
        validate_score(self.score)
        self.shot["layout"] = "standard"
        with self.assertRaisesRegex(ValueError, "precedes"):
            validate_score(self.score)

    def test_unsupported_polyline_head_is_explicit(self):
        self.shot["elements"] = [{
            "id": "path", "type": "polyline", "points": [[0, 0], [10, 10]], "arrow": True,
        }]
        with self.assertRaisesRegex(ValueError, "polyline arrows"):
            validate_score(self.score)

    def test_rejects_invalid_tracks_even_after_first_keyframe(self):
        self.shot["elements"] = [{"id": "dot", "type": "circle", "x": [[0, 5], [0, 10]]}]
        with self.assertRaisesRegex(ValueError, "keyframes"):
            validate_score(self.score)

    def test_rejects_unknown_layout(self):
        self.shot["layout"] = "unknown"
        with self.assertRaisesRegex(ValueError, "layout"):
            validate_score(self.score)


class RendererTests(unittest.TestCase):
    def setUp(self):
        self.renderer = Renderer(1280, 720, font_path())
        self.shot = {
            "id": "s01", "heading": "Příliš žluťoučký kůň", "takeaway": "České znaky",
            "source": "Illustrative model", "elements": [
                {"id": "particle", "type": "circle", "x": [[0, 200], [1, 800]],
                 "y": 350, "r": 12, "color": "#79d4c2"},
            ],
        }

    def test_object_changes_position(self):
        before = self.renderer.frame(self.shot, 0, 0, "Test")
        after = self.renderer.frame(self.shot, 1, 0, "Test")
        self.assertNotEqual(before.getpixel((200, 350)), after.getpixel((200, 350)))
        self.assertNotEqual(before.getpixel((800, 350)), after.getpixel((800, 350)))

    def test_clipped_text_fails(self):
        self.shot["elements"].append({
            "id": "bad", "type": "text", "x": 1270, "y": 200, "text": "Too wide",
        })
        with self.assertRaisesRegex(ValueError, "Clipped text"):
            self.renderer.frame(self.shot, 0, 0, "Test")

    def test_metadata_and_progress_are_not_drawn(self):
        self.shot["elements"] = []
        before = self.renderer.frame(self.shot, 1.99, 0, "Test").tobytes()
        self.shot.update(id="changed-debug-id", source="Another source", takeaway="Another takeaway")
        after = self.renderer.frame(self.shot, 2, 1, "Test").tobytes()
        self.assertEqual(before, after)
        self.assertEqual(set(self.renderer.bounds), {"chapter", "heading"})

    def test_authored_answer_waits_for_reveal(self):
        self.shot["elements"] = [{
            "id": "answer", "type": "text", "x": 200, "y": 350,
            "text": "Answer", "show": [2, 9],
        }]
        before = self.renderer.frame(self.shot, 1.99, 0, "Test")
        self.assertNotIn("answer", self.renderer.bounds)
        after = self.renderer.frame(self.shot, 2, 0, "Test")
        self.assertIn("answer", self.renderer.bounds)
        self.assertNotEqual(before.tobytes(), after.tobytes())

    def test_title_layout_has_no_automatic_header(self):
        self.shot.update(layout="title", elements=[])
        image = self.renderer.frame(self.shot, 0, 0, "Test")
        self.assertEqual(image.getcolors(), [(1280 * 720, tuple(bytes.fromhex(BG[1:])))])
        self.assertEqual(self.renderer.bounds, {})

    def test_diagonal_geometry_has_antialiased_edges(self):
        self.shot["elements"] = [{
            "id": "diagonal", "type": "line", "x": 200, "y": 240,
            "x2": 980, "y2": 500, "color": "#ffffff", "stroke": 3,
        }]
        image = self.renderer.frame(self.shot, 0, 0, "Test").crop((180, 220, 1000, 520))
        self.assertGreater(len(image.getcolors(maxcolors=65536)), 10)

    def test_shaft_does_not_protrude_through_arrow_tip(self):
        self.shot["elements"] = [{
            "id": "arrow", "type": "line", "x": 200, "y": 300,
            "x2": 800, "y2": 300, "color": "#ffffff", "stroke": 8, "arrow": True,
        }]
        image = self.renderer.frame(self.shot, 0, 0, "Test")
        background = tuple(bytes.fromhex(BG[1:]))
        self.assertLess(sum(abs(a-b) for a, b in zip(image.getpixel((799, 303)), background)), 30)
        self.assertGreater(sum(image.getpixel((799, 300))), 500)

    def test_last_frame_cache_tracks_visibility_and_protects_image(self):
        first = self.renderer.frame(self.shot, 0, 0, "Test")
        expected = first.tobytes()
        first.paste("red", (0, 0, 100, 100))
        self.assertEqual(self.renderer.frame(self.shot, 0, 1, "Test").tobytes(), expected)
        self.shot["heading"] = "Changed heading"
        self.assertNotEqual(self.renderer.frame(self.shot, 0, 1, "Test").tobytes(), expected)

    def test_bad_aspect_ratio_fails(self):
        with self.assertRaises(ValueError):
            Renderer(800, 600, font_path())


class AssemblyTests(unittest.TestCase):
    def test_dynamic_normalization_uses_measured_gain_response(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "work").mkdir()
            audio = output / "audio.wav"
            audio.write_bytes(b"unit-test-hash-input")
            shot, timing = {"id": "unit"}, {"audio": str(audio)}
            score, timeline = {"shots": [shot]}, {"shots": [timing], "duration": 1}
            renderer = Renderer(320, 180, font_path())
            clip = output / "work" / "unit.mp4"
            clip.write_bytes(b"mocked-encoder-input")
            clip.with_suffix(".sha256").write_text(render_digest(shot, timing, renderer, 1))
            observations = iter(("-16.95", "-16.74", "-16.30"))

            def fake_run(command):
                if command[0] == "ffprobe":
                    return subprocess.CompletedProcess(command, 0, stdout="{}", stderr="")
                if str(output / "video.mp4") in command and command[-1] == "-":
                    value = {"input_i": next(observations), "input_tp": "-2.8"}
                else:
                    value = {"input_i": "-19", "input_tp": ".2", "input_lra": "3",
                             "input_thresh": "-29", "target_offset": ".3"}
                return subprocess.CompletedProcess(command, 0, stdout="", stderr=json.dumps(value))

            with patch("film.run", side_effect=fake_run):
                assemble(score, timeline, output, renderer)
            report = read_json(output / "loudness.json")
            self.assertTrue(report["passed"])
            self.assertEqual(len(report["attempts"]), 3)
            self.assertAlmostEqual(report["attempts"][2]["offset"], 4.21)
            self.assertIn("secant", report["attempts"][1]["response_model"])

    def test_encoded_audio_correction_is_measured_and_bounded(self):
        for failure in ("loudness", "peak"):
            for recovers in (True, False):
                with self.subTest(failure=failure, recovers=recovers), tempfile.TemporaryDirectory() as directory:
                    output = Path(directory)
                    (output / "work").mkdir()
                    audio = output / "audio.wav"
                    audio.write_bytes(b"unit-test-hash-input")
                    shot, timing = {"id": "unit"}, {"audio": str(audio)}
                    score, timeline = {"shots": [shot]}, {"shots": [timing], "duration": 1}
                    renderer = Renderer(320, 180, font_path())
                    clip = output / "work" / "unit.mp4"
                    clip.write_bytes(b"mocked-encoder-input")
                    clip.with_suffix(".sha256").write_text(render_digest(shot, timing, renderer, 1))
                    measurements = []

                    def fake_run(command):
                        if command[0] == "ffprobe":
                            return subprocess.CompletedProcess(command, 0, stdout="{}", stderr="")
                        if str(output / "video.mp4") in command and command[-1] == "-":
                            value = {"input_i": "-16.8" if failure == "loudness" else "-16",
                                     "input_tp": "-1.2" if failure == "peak" else "-2"}
                            if recovers and measurements:
                                value = {"input_i": "-16", "input_tp": "-2"}
                            measurements.append(value)
                        else:
                            value = {"input_i": "-19", "input_tp": ".2", "input_lra": "3",
                                     "input_thresh": "-29", "target_offset": ".3"}
                        return subprocess.CompletedProcess(command, 0, stdout="", stderr=json.dumps(value))

                    with patch("film.run", side_effect=fake_run):
                        if recovers:
                            assemble(score, timeline, output, renderer)
                        else:
                            with self.assertRaisesRegex(RuntimeError, "after four attempts"):
                                assemble(score, timeline, output, renderer)
                    report = read_json(output / "loudness.json")
                    self.assertEqual(len(measurements), 2 if recovers else 4)
                    self.assertEqual(report["passed"], recovers)
                    self.assertAlmostEqual(report["attempts"][1]["offset"],
                                           1.1 if failure == "loudness" else .3)
                    self.assertAlmostEqual(report["attempts"][1]["peak_target"],
                                           -3.5 if failure == "peak" else -3)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg smoke test")
class FilmSmokeTests(unittest.TestCase):
    def test_english_held_out_score_encodes_with_captions_and_chapter(self):
        true_positive, false_positive = 100 * .9, 9900 * .05
        self.assertAlmostEqual(true_positive / (true_positive + false_positive), .1538461538)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            audio = output / "fixture.wav"
            with wave.open(str(audio), "wb") as wav:
                wav.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
                wav.writeframes(b"".join(
                    struct.pack("<h", round(6000 * math.sin(2*math.pi*220*n/24000)))
                    for n in range(30000)))

            class OfflineTone:
                voice, locale = "offline-test-tone", "en-US"

                def synthesize(self, text):
                    return audio, wav_info(audio.read_bytes())

            score = {"title": "Base rate = 90 / 585; #fixture", "subtitle_language": "eng", "shots": [{
                "id": "base-rate", "chapter": "Conditional probability",
                "heading": "What is the denominator?", "takeaway": "90 / (90 + 495) = 15.4%",
                "sentences": ["Start with ten thousand.", "Ninety true positives.",
                              "Four hundred ninety-five false positives."],
                "elements": [
                    {"id": "true", "type": "rect", "x": 200, "y": 300,
                     "w": [[0, 0], [1, true_positive]], "h": 50, "color": "#79d4c2"},
                    {"id": "false", "type": "rect", "x": 200, "y": 400,
                     "w": [[1, 0], [2, false_positive]], "h": 50, "color": "#f6bd60"},
                ],
            }]}
            result_shot = copy.deepcopy(score["shots"][0])
            result_shot.update(id="posterior", chapter="Result", heading="Positive tests are the denominator.")
            score["shots"].append(result_shot)
            validate_score(score)
            timeline = prepare(score, OfflineTone(), output, 24)
            captions(score, timeline, output)
            renderer = Renderer(320, 180, font_path())
            render(score, timeline, output, renderer, 24)
            assemble(score, timeline, output, renderer)
            probe = read_json(output / "ffprobe.json")
            streams = {s["codec_type"]: s for s in probe["streams"]}
            self.assertEqual(streams["video"]["codec_name"], "h264")
            self.assertEqual(streams["subtitle"]["tags"]["language"], "eng")
            self.assertEqual(len(probe["chapters"]), 2)
            self.assertEqual(probe["format"]["tags"]["title"], score["title"])
            self.assertAlmostEqual(float(probe["format"]["duration"]), timeline["duration"], delta=.12)
            self.assertLess(abs(float(streams["audio"]["duration"])-float(streams["video"]["duration"])), .025)
            run(["ffmpeg", "-v", "error", "-xerror", "-i", str(output / "video.mp4"),
                 "-map", "0:v", "-map", "0:a", "-f", "null", "-"])
            timeline["duration"] += 1
            with self.assertRaisesRegex(RuntimeError, "Stale render"):
                assemble(score, timeline, output, renderer)
            timeline["duration"] -= 1
            timeline["shots"][0]["units"][0]["text"] = "Changed after rendering."
            with self.assertRaisesRegex(RuntimeError, "Stale render"):
                assemble(score, timeline, output, renderer)


if __name__ == "__main__":
    unittest.main()
