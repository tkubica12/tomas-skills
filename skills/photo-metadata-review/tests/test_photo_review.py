import argparse
import json
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import common
import photo_review
import write_descriptions as writer


EXIFTOOL = os.environ.get("PHOTO_TEST_EXIFTOOL")


@unittest.skipUnless(EXIFTOOL, "Set PHOTO_TEST_EXIFTOOL to exercise ExifTool integration")
class PhotoReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.photos = self.root / "photos"
        self.raw = self.root / "raw"
        self.photos.mkdir()
        self.raw.mkdir()
        self.review = self.root / "private-review"
        self.jpg = self.photos / "obrázek.jpg"
        Image.new("RGB", (43, 29), (20, 75, 120)).save(self.jpg, "JPEG")
        common.exiftool(EXIFTOOL, [
            "-overwrite_original_in_place",
            "-DateTimeOriginal=2026:03:04 12:34:56",
            "-XMP-dc:Description-fr=Ancienne description",
            self.jpg,
        ])

    def tearDown(self):
        self.temp.cleanup()

    def initialize(self, raw=False):
        result = photo_review.initialize(argparse.Namespace(
            photos=str(self.photos), raw=str(self.raw) if raw else None,
            review=str(self.review), exiftool=EXIFTOOL, language="cs",
        ))
        self.state_path = Path(result["state"])
        return result

    def propose(self, description="Klášter u města.", confidence="low"):
        proposals = self.root / "proposals.json"
        proposals.write_text(json.dumps([{
            "id": self.jpg.name, "description": description,
            "confidence": confidence, "visuallyExamined": True, "evidence": [],
        }]), encoding="utf-8")
        return photo_review.apply(argparse.Namespace(
            state=str(self.state_path), revision=common.revision(self.state_path),
            proposals=str(proposals), feedback_id=None,
        ))

    def approve(self):
        state = common.load_json(self.state_path)
        request_id = str(uuid.uuid4())
        state["writeRequest"] = {
            "id": request_id,
            "status": "pending",
            "approvedAt": common.now(),
            "photoDirectory": state["photoDirectory"],
            "rawDirectory": state["rawDirectory"],
            "photos": json.loads(json.dumps(state["photos"])),
        }
        common.save_json(self.state_path, state)
        return request_id

    def test_low_confidence_is_written_and_verified_without_retained_copy(self):
        self.initialize()
        self.propose()
        request_id = self.approve()
        result = writer.run(self.state_path, request_id, EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["verifiedRaw"]), (1, 0))
        self.assertEqual(common.load_json(self.state_path)["writeRequest"]["status"], "completed")
        self.assertEqual(list((self.review / "recovery").iterdir()), [])
        entry = writer.metadata(EXIFTOOL, self.jpg)
        self.assertEqual(entry["IFD0:ImageDescription"], "Klášter u města.")
        self.assertEqual(entry["XMP-dc:Description"], "Klášter u města.")
        self.assertEqual(entry["XMP-dc:Description-fr"], "Ancienne description")

    def test_second_approval_uses_the_verified_updated_fingerprint(self):
        self.initialize()
        self.propose("První popis.")
        writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.propose("Opravený popis.")
        result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["skippedJpg"]), (1, 0))
        self.assertEqual(writer.metadata(EXIFTOOL, self.jpg)["XMP-dc:Description"], "Opravený popis.")

    def test_ambiguous_raw_is_skipped_but_jpeg_is_written(self):
        Image.new("RGB", (8, 8)).save(self.raw / "obrázek.ARW", "JPEG")
        Image.new("RGB", (8, 8)).save(self.raw / "obrázek.DNG", "JPEG")
        self.initialize(raw=True)
        self.propose()
        result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["verifiedRaw"], result["skippedRaw"]), (1, 0, 1))

    def test_new_matching_raw_after_approval_is_treated_as_ambiguous(self):
        Image.new("RGB", (8, 8)).save(self.raw / "obrázek.ARW", "JPEG")
        self.initialize(raw=True)
        self.propose()
        request_id = self.approve()
        Image.new("RGB", (8, 8)).save(self.raw / "obrázek.DNG", "JPEG")
        result = writer.run(self.state_path, request_id, EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["verifiedRaw"], result["skippedRaw"]), (1, 0, 1))
        journal = common.load_json(Path(result["journal"]))
        self.assertIn("ambiguous", journal["files"][0]["reason"])

    def test_pairing_is_rechecked_after_jpeg_write(self):
        Image.new("RGB", (8, 8)).save(self.raw / "obrázek.ARW", "JPEG")
        self.initialize(raw=True)
        self.propose()
        request_id = self.approve()
        original_preflight = writer.file_preflight
        original_write = writer.write_file

        def preflight(tool, path, kind, baseline, writable):
            if kind == "RAW":
                return ({"ExifIFD:DateTimeOriginal": "2026:03:04 12:34:56"}, "hash", [], {})
            return original_preflight(tool, path, kind, baseline, writable)

        def write_and_add_candidate(*args):
            result = original_write(*args)
            if args[2] == "JPG":
                Image.new("RGB", (8, 8)).save(self.raw / "obrázek.DNG", "JPEG")
            return result

        with mock.patch.object(writer, "file_preflight", side_effect=preflight), \
             mock.patch.object(writer, "write_file", side_effect=write_and_add_candidate):
            result = writer.run(self.state_path, request_id, EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["verifiedRaw"], result["skippedRaw"]), (1, 0, 1))
        journal = common.load_json(Path(result["journal"]))
        self.assertIn("changed during", journal["files"][-1]["reason"])

    def test_explicit_file_selection_does_not_add_other_jpegs(self):
        Image.new("RGB", (8, 8)).save(self.photos / "unselected.jpg", "JPEG")
        result = photo_review.initialize(argparse.Namespace(
            photos=str(self.photos), raw=None, review=str(self.review),
            exiftool=EXIFTOOL, language="en", files=[self.jpg.name],
        ))
        state = common.load_json(Path(result["state"]))
        self.assertEqual([photo["id"] for photo in state["photos"]], [self.jpg.name])

    def test_changed_source_is_not_written(self):
        self.initialize()
        self.propose()
        request_id = self.approve()
        with self.jpg.open("ab") as out:
            out.write(b"changed")
        changed = common.digest(self.jpg)
        result = writer.run(self.state_path, request_id, EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["skippedJpg"]), (0, 1))
        self.assertEqual(common.digest(self.jpg), changed)

    def test_failed_write_retains_verified_recovery_copy(self):
        self.initialize()
        self.propose()
        request_id = self.approve()
        original_hash = common.digest(self.jpg)
        actual = writer.exiftool

        def faulty(tool, arguments):
            if "-overwrite_original_in_place" in arguments:
                self.jpg.write_bytes(b"interrupted")
                raise RuntimeError("Simulated interruption")
            return actual(tool, arguments)

        with mock.patch.object(writer, "exiftool", side_effect=faulty):
            with self.assertRaisesRegex(RuntimeError, "Simulated interruption"):
                writer.run(self.state_path, request_id, EXIFTOOL)
        request = common.load_json(self.state_path)["writeRequest"]
        self.assertEqual(request["status"], "stopped")
        copies = request["result"]["recoveryCopies"]
        self.assertEqual(len(copies), 1)
        self.assertEqual(common.digest(Path(copies[0])), original_hash)
        self.assertEqual(self.jpg.read_bytes(), b"interrupted")

    def test_corrupted_output_is_not_reported_as_success(self):
        self.initialize()
        self.propose()
        request_id = self.approve()
        original_hash = common.digest(self.jpg)
        actual = writer.exiftool

        def faulty(tool, arguments):
            output = actual(tool, arguments)
            if "-overwrite_original_in_place" in arguments:
                self.jpg.write_bytes(b"corrupt")
            return output

        with mock.patch.object(writer, "exiftool", side_effect=faulty):
            with self.assertRaises((RuntimeError, writer.SafetySkip)):
                writer.run(self.state_path, request_id, EXIFTOOL)
        request = common.load_json(self.state_path)["writeRequest"]
        self.assertEqual(request["status"], "stopped")
        self.assertEqual(request["result"]["verifiedJpg"], 0)
        self.assertEqual(common.digest(Path(request["result"]["recoveryCopies"][0])), original_hash)

    def test_concurrent_state_edit_is_not_overwritten(self):
        self.initialize()
        self.propose()
        request_id = self.approve()
        actual = writer.exiftool

        def concurrent_edit(tool, arguments):
            output = actual(tool, arguments)
            if "-overwrite_original_in_place" in arguments:
                external = common.load_json(self.state_path)
                external["externalNote"] = "Keep this change"
                common.save_json(self.state_path, external)
            return output

        with mock.patch.object(writer, "exiftool", side_effect=concurrent_edit):
            with self.assertRaisesRegex(RuntimeError, "Review state changed"):
                writer.run(self.state_path, request_id, EXIFTOOL)
        self.assertEqual(common.load_json(self.state_path)["externalNote"], "Keep this change")
        journal = common.load_json(self.review / f"journal-{request_id}.json")
        self.assertEqual(journal["status"], "stopped")
        self.assertTrue(Path(journal["files"][-1]["recoveryCopy"]).is_file())

    @unittest.skipUnless(os.name == "nt", "NTFS alternate streams require Windows")
    def test_windows_alternate_stream_is_preserved(self):
        stream = Path(str(self.jpg) + ":photo-review-test")
        stream.write_bytes(b"other file data")
        self.initialize()
        self.propose()
        result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual(result["verifiedJpg"], 1)
        self.assertEqual(stream.read_bytes(), b"other file data")

    def test_stale_proposals_do_not_change_state(self):
        self.initialize()
        proposals = self.root / "proposals.json"
        proposals.write_text(json.dumps([{
            "id": self.jpg.name, "description": "Place", "confidence": "high",
            "visuallyExamined": True,
        }]), encoding="utf-8")
        original = self.state_path.read_bytes()
        with self.assertRaisesRegex(RuntimeError, "Review changed"):
            photo_review.apply(argparse.Namespace(
                state=str(self.state_path), revision="stale", proposals=str(proposals), feedback_id=None,
            ))
        self.assertEqual(self.state_path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
