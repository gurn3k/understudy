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


if __name__ == "__main__":
    unittest.main()
