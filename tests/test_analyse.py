import json
import unittest
from pathlib import Path

from understudy.analyse import analyse
from understudy.parse import parse_log

FIX = Path(__file__).parent / "fixtures"
KEY = json.loads((FIX / "answer_key.json").read_text(encoding="utf-8"))


class AnalyseAgainstKey(unittest.TestCase):
    def run_file(self, name):
        cases, _ = parse_log(FIX / name)
        return analyse(cases), KEY[name]

    def check(self, name):
        got, key = self.run_file(name)
        self.assertEqual(got["kept"], key["kept"])
        self.assertEqual(got["users"], key["users"])
        self.assertEqual(set(got["activities"]), set(key["activities"]))
        for act, want in key["activities"].items():
            g = got["activities"][act]
            for field in ("events", "manual", "batch", "unclassified", "cases", "repeat"):
                self.assertEqual(g[field], want[field], f"{act} {field}")
            if "repeat_cases" in want:
                self.assertEqual(g["repeat_case_ids"], want["repeat_cases"], act)
            self.assertEqual(len(g["case_ids"]), g["cases"], act)
        for flag, want in key["flagged"].items():
            g = got["flagged"][flag]
            self.assertEqual(g["count"], want["count"], flag)
            self.assertEqual(g["cases"], want["cases"], flag)
            if "by_batch" in want:
                self.assertEqual(g["by_batch"], want["by_batch"], flag)
        return got

    def test_planted(self):
        self.check("planted.xes")

    def test_clean_control(self):
        self.check("clean.xes")

    def test_shares_add_up_per_activity(self):
        got, _ = self.run_file("planted.xes")
        for act, a in got["activities"].items():
            self.assertEqual(a["manual"] + a["batch"] + a["unclassified"], a["events"], act)
        self.assertEqual(sum(a["events"] for a in got["activities"].values()), got["kept"]["events"])

    def test_partial_deliveries_are_not_rework(self):
        got, _ = self.run_file("planted.xes")
        for act in ("Record Goods Receipt", "Record Invoice Receipt", "Vendor creates invoice"):
            self.assertEqual(got["activities"][act]["repeat"], "multiple expected", act)
            self.assertEqual(got["activities"][act]["repeat_case_ids"], [], act)


if __name__ == "__main__":
    unittest.main()
