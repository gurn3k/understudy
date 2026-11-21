"""build_site keeps the committed run time unless --retime is passed (it differs between builds only by noise)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import build_site as S  # noqa: E402


class KeptRunTime(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / "data.json"

    def tearDown(self):
        self.dir.cleanup()

    def write(self, data):
        self.path.write_text(json.dumps(data), encoding="utf-8")

    def test_keeps_the_committed_value(self):
        self.write({"cost": {"c_run_s_all_held_out": 0.584}})
        self.assertEqual(S.kept_run_time(0.5649, self.path), 0.584)

    def test_retime_takes_the_new_measurement(self):
        self.write({"cost": {"c_run_s_all_held_out": 0.584}})
        self.assertEqual(S.kept_run_time(0.5649, self.path, retime=True), 0.565)

    def test_measures_when_there_is_no_committed_value(self):
        self.assertEqual(S.kept_run_time(0.5649, self.path), 0.565)
        self.write({"cost": {}})
        self.assertEqual(S.kept_run_time(0.5649, self.path), 0.565)


class LaterCheck(unittest.TestCase):
    def test_none_until_the_check_has_run(self):
        self.assertIsNone(S.confirm_summary(Path(tempfile.gettempdir()) / "no-such-result.json"))

    def test_committed_result_carries_the_readings(self):
        if not S.CONFIRM.exists():
            self.skipTest("no committed result")
        c = S.confirm_summary()
        self.assertEqual(set(c["readings"]), {"rulebook", "shortlist"})
        self.assertEqual(c["september"]["lines"], 4227)
        self.assertEqual(c["consequences"]["headline"], "unchanged (not proven)")
        self.assertIn("interval", c["september"]["approaches"]["rulebook"]["main"])


if __name__ == "__main__":
    unittest.main()
