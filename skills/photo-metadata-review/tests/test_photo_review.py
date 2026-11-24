import argparse
import io
import json
import os
import shutil
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
CR2_SAMPLE = os.environ.get("PHOTO_TEST_CR2")


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

    def initialize_selected(self):
        result = photo_review.initialize(argparse.Namespace(
            photos=str(self.photos), raw=None, review=str(self.review),
            exiftool=EXIFTOOL, language="cs", files=[self.jpg.name],
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
                return ({"ExifIFD:DateTimeOriginal": "2026:03:04 12:34:56"}, "hash", [], {}, None)
            return original_preflight(tool, path, kind, baseline, writable)

        def write_and_add_candidate(*args, **kwargs):
            result = original_write(*args, **kwargs)
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
        actual = writer.exiftool_run

        def faulty(tool, arguments):
            if Path(arguments[-1]) != self.jpg:
                return actual(tool, arguments)
            self.jpg.write_bytes(b"interrupted")
            raise RuntimeError("Simulated interruption")

        with mock.patch.object(writer, "exiftool_run", side_effect=faulty):
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
        actual = writer.exiftool_run

        def faulty(tool, arguments):
            output = actual(tool, arguments)
            if Path(arguments[-1]) == self.jpg:
                self.jpg.write_bytes(b"corrupt")
            return output

        with mock.patch.object(writer, "exiftool_run", side_effect=faulty):
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
        actual = writer.exiftool_run

        def concurrent_edit(tool, arguments):
            output = actual(tool, arguments)
            if Path(arguments[-1]) == self.jpg:
                external = common.load_json(self.state_path)
                external["externalNote"] = "Keep this change"
                common.save_json(self.state_path, external)
            return output

        with mock.patch.object(writer, "exiftool_run", side_effect=concurrent_edit):
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

    def make_mpo(self):
        Image.new("RGB", (64, 48), (200, 30, 30)).save(
            self.jpg, "MPO", save_all=True, append_images=[Image.new("RGB", (32, 24), (10, 200, 10))],
        )
        common.exiftool(EXIFTOOL, ["-overwrite_original_in_place", "-DateTimeOriginal=2026:03:04 12:34:56", self.jpg])
        data = self.jpg.read_bytes()
        structure = writer.jpeg_structure(self.jpg, writer.metadata(EXIFTOOL, self.jpg))
        self.assertEqual(len(structure["mpf"]), 2)
        start = structure["mpf"][1]["start"]
        return data[start:start + structure["mpf"][1]["length"]]

    def test_multipicture_payload_is_preserved_and_relocation_recorded(self):
        second = self.make_mpo()
        self.initialize()
        self.propose("Delší popis, aby se posunul MPF obraz.")
        result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual(result["verifiedJpg"], 1)
        record = common.load_json(Path(result["journal"]))["files"][0]
        self.assertEqual(record["embeddedImagesVerified"], 1)
        old, new = record["relocatedMetadata"]["MPImage2:MPImageStart"]
        self.assertNotEqual(old, new)
        self.assertEqual(self.jpg.read_bytes()[new:new + len(second)], second)

    def test_changed_multipicture_payload_stops_with_recovery_copy(self):
        self.make_mpo()
        self.initialize()
        self.propose()
        request_id = self.approve()
        original_hash = common.digest(self.jpg)
        actual = writer.exiftool_run

        def corrupt_trailer(tool, arguments):
            output = actual(tool, arguments)
            if Path(arguments[-1]) == self.jpg:
                data = bytearray(self.jpg.read_bytes())
                data[-200] ^= 0xFF
                self.jpg.write_bytes(bytes(data))
            return output

        with mock.patch.object(writer, "exiftool_run", side_effect=corrupt_trailer):
            with self.assertRaises((RuntimeError, writer.SafetySkip)):
                writer.run(self.state_path, request_id, EXIFTOOL)
        request = common.load_json(self.state_path)["writeRequest"]
        self.assertEqual(request["status"], "stopped")
        self.assertEqual(common.digest(Path(request["result"]["recoveryCopies"][0])), original_hash)

    def test_clean_exiftool_refusal_is_skipped_without_changes(self):
        self.initialize()
        self.propose()
        original_hash = common.digest(self.jpg)
        refusal = (1, "    0 image files updated\n    1 files weren't updated due to errors\n",
                   "Error: Error reading OtherImageStart data in IFD0 - x.jpg\n")
        with mock.patch.object(writer, "exiftool_run", return_value=refusal):
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["skippedJpg"], result["failed"]), (0, 1, 0))
        self.assertEqual(common.digest(self.jpg), original_hash)
        self.assertEqual(list((self.review / "recovery").iterdir()), [])

    def test_trial_warning_skips_original_before_write(self):
        self.initialize()
        self.propose()
        original = common.fingerprint(self.jpg)
        actual = writer.exiftool_run
        written = []

        def warning(tool, arguments):
            written.append(Path(arguments[-1]))
            code, output, stderr = actual(tool, arguments)
            return code, output, stderr + "Warning: [minor] Maker notes could not be parsed - trial.jpg\n"

        with mock.patch.object(writer, "exiftool_run", side_effect=warning):
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["skippedJpg"], result["failed"]), (0, 1, 0))
        self.assertEqual(common.fingerprint(self.jpg), original)
        self.assertNotIn(self.jpg, written)
        record = common.load_json(Path(result["journal"]))["files"][0]
        self.assertIn("Maker notes could not be parsed", record["reason"])

    def test_trial_metadata_change_skips_original_before_write(self):
        self.initialize()
        self.propose()
        original = common.fingerprint(self.jpg)
        actual = writer.metadata

        def altered_metadata(tool, path):
            entry = actual(tool, path)
            if "photo-write-trial-" in str(path) and entry.get("IFD0:ImageDescription") == "Klášter u města.":
                entry["IFD0:YCbCrPositioning"] = 9999
            return entry

        with mock.patch.object(writer, "metadata", side_effect=altered_metadata):
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["skippedJpg"], result["failed"]), (0, 1, 0))
        self.assertEqual(common.fingerprint(self.jpg), original)
        record = common.load_json(Path(result["journal"]))["files"][0]
        self.assertIn("IFD0:YCbCrPositioning", record["reason"])

    def test_trial_retries_added_ycbcr_without_mandatory_tags(self):
        common.exiftool(EXIFTOOL, [
            "-api", "NoMandatory=1", "-overwrite_original_in_place",
            "-IFD0:YCbCrPositioning=", self.jpg,
        ])
        self.initialize()
        self.propose()
        actual = writer.write_file
        attempted = []

        def inject_default_change(*args, **kwargs):
            attempted.append((Path(args[1]), kwargs.get("no_mandatory", False)))
            if Path(args[1]) != self.jpg and not kwargs.get("no_mandatory", False):
                raise writer.UnsafeMetadataChange(["IFD0:YCbCrPositioning"])
            return actual(*args, **kwargs)

        with mock.patch.object(writer, "write_file", side_effect=inject_default_change):
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedJpg"], result["skippedJpg"], result["failed"]), (1, 0, 0))
        self.assertEqual([option for _, option in attempted], [False, True, True])
        self.assertEqual(attempted[-1][0], self.jpg)
        self.assertNotIn("IFD0:YCbCrPositioning", writer.metadata(EXIFTOOL, self.jpg))
        record = common.load_json(Path(result["journal"]))["files"][0]
        self.assertTrue(record["exiftoolNoMandatory"])

    def test_trial_does_not_retry_multiple_metadata_changes(self):
        self.initialize()
        self.propose()
        original = common.fingerprint(self.jpg)
        change = writer.UnsafeMetadataChange(["IFD0:Orientation", "IFD0:YCbCrPositioning"])
        with mock.patch.object(writer, "write_file", side_effect=change) as write:
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["skippedJpg"], result["failed"]), (1, 0))
        self.assertEqual(write.call_count, 1)
        self.assertEqual(common.fingerprint(self.jpg), original)

    def test_trial_does_not_retry_change_to_existing_ycbcr(self):
        common.exiftool(EXIFTOOL, [
            "-overwrite_original_in_place", "-IFD0:YCbCrPositioning#=2", self.jpg,
        ])
        self.initialize()
        self.propose()
        original = common.fingerprint(self.jpg)
        change = writer.UnsafeMetadataChange(["IFD0:YCbCrPositioning"])
        with mock.patch.object(writer, "write_file", side_effect=change) as write:
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["skippedJpg"], result["failed"]), (1, 0))
        self.assertEqual(write.call_count, 1)
        self.assertEqual(common.fingerprint(self.jpg), original)

    def test_unexpected_trial_error_stops_without_writing_source(self):
        self.initialize()
        self.propose()
        original = common.fingerprint(self.jpg)
        with mock.patch.object(writer, "trial_jpeg_write", side_effect=RuntimeError("trial storage error")):
            with self.assertRaisesRegex(RuntimeError, "trial storage error"):
                writer.run(self.state_path, self.approve(), EXIFTOOL)
        state = common.load_json(self.state_path)
        self.assertEqual(state["writeRequest"]["status"], "stopped")
        self.assertEqual(common.fingerprint(self.jpg), original)

    def test_unsafe_jpeg_trial_skips_paired_raw(self):
        raw = self.raw / "obrázek.ARW"
        shutil.copy2(self.jpg, raw)
        self.initialize(raw=True)
        self.propose()
        jpg_before, raw_before = common.fingerprint(self.jpg), common.fingerprint(raw)
        actual = writer.file_preflight

        def preflight(tool, path, kind, baseline, writable):
            if kind == "RAW":
                return ({"ExifIFD:DateTimeOriginal": "2026:03:04 12:34:56"}, "hash", [], {}, None)
            return actual(tool, path, kind, baseline, writable)

        with mock.patch.object(writer, "file_preflight", side_effect=preflight), \
             mock.patch.object(writer, "trial_jpeg_write", side_effect=writer.SafetySkip("unsafe trial")), \
             mock.patch.object(writer, "write_file") as write:
            result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["skippedJpg"], result["skippedRaw"], result["failed"]), (1, 1, 0))
        write.assert_not_called()
        self.assertEqual(common.fingerprint(self.jpg), jpg_before)
        self.assertEqual(common.fingerprint(raw), raw_before)

    def test_existing_caption_is_retained_at_initialization(self):
        common.exiftool(EXIFTOOL, [
            "-overwrite_original_in_place", "-IFD0:ImageDescription=Starý popis.",
            "-XMP-dc:Description-x-default=Starý popis.", self.jpg,
        ])
        self.initialize()
        photo = common.load_json(self.state_path)["photos"][0]
        self.assertEqual((photo["description"], photo["descriptionSource"]), ("Starý popis.", "existing"))

    def test_conflicting_or_placeholder_captions_are_not_prefilled(self):
        common.exiftool(EXIFTOOL, [
            "-overwrite_original_in_place", "-IFD0:ImageDescription=OLYMPUS DIGITAL CAMERA", self.jpg,
        ])
        self.initialize()
        photo = common.load_json(self.state_path)["photos"][0]
        self.assertEqual(photo["description"], "")
        self.assertEqual(photo["existingDescription"]["exif"], "OLYMPUS DIGITAL CAMERA")

    def test_chat_approval_freezes_request_for_writer(self):
        self.initialize()
        self.propose()
        approved = photo_review.approve(argparse.Namespace(
            state=str(self.state_path), revision=common.revision(self.state_path),
            authorization="Ano, zapiš popisy.",
        ))
        request = common.load_json(self.state_path)["writeRequest"]
        self.assertEqual((request["approvedVia"], request["authorization"]), ("chat", "Ano, zapiš popisy."))
        result = writer.run(self.state_path, approved["requestId"], EXIFTOOL)
        self.assertEqual(result["verifiedJpg"], 1)

    def test_chat_approval_requires_current_revision_and_descriptions(self):
        self.initialize()
        with self.assertRaisesRegex(RuntimeError, "Review changed"):
            photo_review.approve(argparse.Namespace(state=str(self.state_path), revision="stale", authorization="Ano"))
        with self.assertRaisesRegex(ValueError, "valid description"):
            photo_review.approve(argparse.Namespace(
                state=str(self.state_path), revision=common.revision(self.state_path), authorization="Ano",
            ))

    def test_standalone_multipage_tiff_is_written_and_verified(self):
        self.jpg = self.photos / "photo.tif"
        Image.new("RGB", (43, 29), (20, 75, 120)).save(
            self.jpg, save_all=True, append_images=[Image.new("RGB", (13, 17), (1, 2, 3))],
        )
        self.initialize_selected()
        self.propose()
        before = writer.decoded_hash(self.jpg, "TIFF", {})
        result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedTiff"], result["skippedTiff"]), (1, 0))
        self.assertEqual(writer.decoded_hash(self.jpg, "TIFF", {}), before)
        self.assertEqual(writer.metadata(EXIFTOOL, self.jpg)["IFD0:ImageDescription"], "Klášter u města.")

    def test_corrupted_second_tiff_page_retains_recovery_copy(self):
        self.jpg = self.photos / "photo.tif"
        Image.new("RGB", (43, 29), (20, 75, 120)).save(
            self.jpg, save_all=True, append_images=[Image.new("RGB", (13, 17), (1, 2, 3))],
        )
        self.initialize_selected()
        self.propose()
        original_hash = common.digest(self.jpg)
        actual = writer.exiftool_run

        def corrupt_second_page(tool, arguments):
            output = actual(tool, arguments)
            with writer.tifffile.TiffFile(self.jpg) as tiff:
                offset = tiff.pages[1].dataoffsets[0]
            with self.jpg.open("r+b") as image:
                image.seek(offset)
                byte = image.read(1)
                image.seek(offset)
                image.write(bytes([byte[0] ^ 0xFF]))
            return output

        with mock.patch.object(writer, "exiftool_run", side_effect=corrupt_second_page):
            with self.assertRaises((RuntimeError, writer.SafetySkip)):
                writer.run(self.state_path, self.approve(), EXIFTOOL)
        request = common.load_json(self.state_path)["writeRequest"]
        self.assertEqual(request["status"], "stopped")
        self.assertEqual(common.digest(Path(request["result"]["recoveryCopies"][0])), original_hash)

    def test_standalone_photo_cannot_use_paired_raw_directory(self):
        self.jpg = self.photos / "photo.tif"
        Image.new("RGB", (8, 8)).save(self.jpg)
        with self.assertRaisesRegex(ValueError, "paired RAW"):
            photo_review.initialize(argparse.Namespace(
                photos=str(self.photos), raw=str(self.raw), review=str(self.review),
                exiftool=EXIFTOOL, language="cs", files=[self.jpg.name],
            ))

    @unittest.skipUnless(CR2_SAMPLE, "Set PHOTO_TEST_CR2 to a private CR2 sample")
    def test_standalone_cr2_is_written_without_a_jpeg_pair(self):
        self.jpg = self.photos / "photo.CR2"
        shutil.copy2(CR2_SAMPLE, self.jpg)
        self.initialize_selected()
        self.propose()
        result = writer.run(self.state_path, self.approve(), EXIFTOOL)
        self.assertEqual((result["verifiedRaw"], result["skippedRaw"]), (1, 0))
        record = common.load_json(Path(result["journal"]))["files"][0]
        self.assertIn("IFD2:StripOffsets", record["relocatedMetadata"])
        self.assertIn("IFD3:StripOffsets", record["relocatedMetadata"])


class VerificationRuleTests(unittest.TestCase):
    def test_validation_accepts_only_proven_repairs(self):
        before = ["Entries in IFD0 are out of order", "[minor] Odd offset for IFD0 tag 0x0110 Model",
                  "Missing required JPEG ExifIFD tag 0x9000 ExifVersion", "3 Warnings (all minor)"]
        after = ["Missing required JPEG ExifIFD tag 0x9000 ExifVersion", "1 Warning (all minor)"]
        self.assertEqual(len(writer.compare_validation(before, after, ["IFD0"])), 2)
        with self.assertRaisesRegex(RuntimeError, "New or changed"):
            writer.compare_validation(before, before + ["[minor] Something new"], [])
        with self.assertRaisesRegex(RuntimeError, "disappeared"):
            writer.compare_validation(before, ["Entries in IFD0 are out of order"], ["IFD0"])
        with self.assertRaisesRegex(RuntimeError, "not out of order"):
            writer.compare_validation(before, after, ["ExifIFD"])

    def test_relocated_payload_must_be_identical(self):
        payload = {"IFD2:StripOffsets": {"sizes": [10], "sha256": "a"}}
        moved = writer.compare_payloads(payload, payload, {"IFD2:StripOffsets": 5}, {"IFD2:StripOffsets": 9})
        self.assertEqual(moved, {"IFD2:StripOffsets": [5, 9]})
        with self.assertRaisesRegex(RuntimeError, "payloads changed"):
            writer.compare_payloads(payload, {"IFD2:StripOffsets": {"sizes": [10], "sha256": "b"}}, {}, {})

    def test_metadata_offsets_may_move_only_when_payload_proves_relocation(self):
        before = {"IFD0:PreviewImageStart": 4, "Sony:HiddenDataOffset": 8}
        after = {"IFD0:PreviewImageStart": 12, "Sony:HiddenDataOffset": 8}
        with self.assertRaisesRegex(RuntimeError, "PreviewImageStart"):
            writer.compare_metadata(before, after)
        writer.compare_metadata(before, after, {"IFD0:PreviewImageStart": [4, 12]})
        after["Sony:HiddenDataOffset"] = 16
        with self.assertRaisesRegex(RuntimeError, "HiddenDataOffset"):
            writer.compare_metadata(before, after, {"IFD0:PreviewImageStart": [4, 12]})

    def test_negative_or_missing_offset_lengths_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "image"
            path.write_bytes(b"0123456789")
            for entry in (
                {"IFD2:StripOffsets": -1, "IFD2:StripByteCounts": 2},
                {"IFD2:StripOffsets": 1, "IFD2:StripByteCounts": -1},
                {"IFD2:StripOffsets": 1},
            ):
                with self.subTest(entry=entry), self.assertRaises(writer.SafetySkip):
                    writer.offset_payloads(path, entry)

    def test_jpeg_after_nonzero_trailer_padding_is_decoded(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "photo.jpg"
            Image.new("RGB", (8, 8)).save(path, "JPEG")
            embedded = io.BytesIO()
            Image.new("RGB", (3, 5), (1, 2, 3)).save(embedded, "JPEG")
            with path.open("ab") as out:
                out.write(b"arbitrary padding" + embedded.getvalue())
            structure = writer.jpeg_structure(path, {})
            self.assertEqual(len(structure["embedded"]), 1)
            self.assertEqual(structure["embedded"][0]["length"], len(embedded.getvalue()))

    def test_long_exiftool_tile_arrays_are_expanded_before_validation(self):
        basic = [{"File:ImageDataHash": "a" * 64,
                  "SubIFD:TileOffsets": "(Binary data 12 bytes, use -b option to extract)",
                  "SubIFD:TileByteCounts": "(Binary data 8 bytes, use -b option to extract)"}]
        expanded = [{"SubIFD:TileOffsets": "1 5", "SubIFD:TileByteCounts": "2 3"}]
        with mock.patch.object(writer, "exiftool", side_effect=[json.dumps(basic), json.dumps(expanded)]):
            entry = writer.metadata("exiftool", Path("test.ARW"))
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "test.ARW"
            path.write_bytes(b"0123456789")
            self.assertEqual(writer.offset_payloads(path, entry)["SubIFD:TileOffsets"]["sizes"], [2, 3])

    def test_sony_sr2_proof_normalizes_only_valid_directory_pointers(self):
        def block(base):
            data = bytearray(64)
            data[0:2] = (1).to_bytes(2, "little")
            data[2:4] = (0x74C0).to_bytes(2, "little")
            data[4:6] = (4).to_bytes(2, "little")
            data[6:10] = (2).to_bytes(4, "little")
            data[10:14] = (base + 32).to_bytes(4, "little")
            data[32:36] = (base + 40).to_bytes(4, "little")
            data[36:40] = (base + 52).to_bytes(4, "little")
            return data

        before, after = block(1000), block(2000)
        digest = writer.normalized_sony_ifds(before, 1000, "little")
        self.assertEqual(digest, writer.normalized_sony_ifds(after, 2000, "little"))
        after[30] ^= 1
        changed = writer.normalized_sony_ifds(after, 2000, "little")
        self.assertNotEqual(digest, changed)
        with self.assertRaisesRegex(RuntimeError, "Sony SR2 metadata payload changed"):
            writer.compare_sony_sr2(
                {"offset": 1000, "length": 64, "normalizedSha256": digest},
                {"offset": 2000, "length": 64, "normalizedSha256": changed},
            )
        after[32:36] = (9999).to_bytes(4, "little")
        with self.assertRaises(writer.SafetySkip):
            writer.normalized_sony_ifds(after, 2000, "little")

    def test_sony_sr2_rejects_pointer_overlapping_value(self):
        data = bytearray(32)
        data[0:2] = (1).to_bytes(2, "little")
        data[2:4] = (1).to_bytes(2, "little")
        data[4:6] = (7).to_bytes(2, "little")
        data[6:10] = (8).to_bytes(4, "little")
        data[10:14] = (1010).to_bytes(4, "little")
        with self.assertRaises(writer.SafetySkip):
            writer.normalized_sony_ifds(data, 1000, "little")

    def test_sony_hidden_payload_relocation_requires_identical_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "photo.ARW"
            path.write_bytes(b"0123456789abcdefgh")
            before = {"Sony:HiddenDataOffset": 2, "Sony:HiddenDataLength": 4}
            after = {"Sony:HiddenDataOffset": 3, "Sony:HiddenDataLength": 4}
            left = writer.offset_payloads(path, before)
            right = writer.offset_payloads(path, after)
            with self.assertRaisesRegex(RuntimeError, "payloads changed"):
                writer.compare_payloads(left, right, before, after)

    def test_lossless_raw_strip_is_not_mistaken_for_a_jpeg_preview(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "photo.ARW"
            path.write_bytes(b"\xff\xd8raw-data")
            entry = {"SubIFD:StripOffsets": 0, "SubIFD:StripByteCounts": 10}
            result = writer.offset_payloads(path, entry)
            self.assertEqual(result["SubIFD:StripOffsets"]["decodedSha256"], [None])

    def test_jpeg_raw_preview_is_fully_decoded(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "photo.CR2"
            preview = io.BytesIO()
            Image.new("RGB", (4, 6), (1, 2, 3)).save(preview, "JPEG")
            path.write_bytes(preview.getvalue())
            entry = {"IFD0:PreviewImageStart": 0, "IFD0:PreviewImageLength": path.stat().st_size}
            result = writer.offset_payloads(path, entry)
            self.assertIsNotNone(result["IFD0:PreviewImageStart"]["decodedSha256"][0])

    def test_linear_dng_thumbnail_falls_back_to_tifffile(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "photo.dng"
            target = Path(temp) / "thumbnail.jpg"
            pixels = writer.numpy.zeros((20, 30, 3), dtype=writer.numpy.uint16)
            writer.tifffile.imwrite(source, pixels, photometric=34892, metadata=None)
            with mock.patch.object(photo_review.rawpy, "imread", side_effect=photo_review.rawpy.LibRawDataError("no raw")):
                photo_review.thumbnail(source, target)
            with Image.open(target) as preview:
                self.assertEqual(preview.size, (30, 20))


if __name__ == "__main__":
    unittest.main()
