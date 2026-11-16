import json
import tempfile
import unittest
from pathlib import Path

from understudy.parse import parse_log, resource_kind

FIX = Path(__file__).parent / "fixtures"
KEY = json.loads((FIX / "answer_key.json").read_text(encoding="utf-8"))


def kept_totals(cases):
    t = {"cases": len(cases), "events": 0, "manual": 0, "batch": 0, "unclassified": 0}
    for c in cases:
        for e in c["events"]:
            t["events"] += 1
            t[e["kind"]] += 1
    return t


class ParseAgainstKey(unittest.TestCase):
    def check_file(self, name):
        key = KEY[name]
        cases, checks = parse_log(FIX / name)
        self.assertEqual(checks["raw"], key["raw"])
        for reason, want in key["excluded"].items():
            self.assertEqual(checks["excluded"][reason], want, reason)
        self.assertEqual(kept_totals(cases), key["kept"])
        return cases

    def test_planted(self):
        cases = self.check_file("planted.xes")
        by_id = {c["id"]: c for c in cases}
        for cid, name in KEY["planted.xes"]["vendor_name_roundtrip"].items():
            self.assertEqual(by_id[cid]["vendor_name"], name)

    def test_clean_control_has_no_exclusions(self):
        self.check_file("clean.xes")

    def test_log_level_and_global_names_are_not_cases(self):
        cases, _ = parse_log(FIX / "planted.xes")
        ids = {c["id"] for c in cases}
        self.assertNotIn("BPI Challenge 2019", ids)
        self.assertNotIn("UNKNOWN", ids)

    def test_events_sorted_by_time(self):
        cases, _ = parse_log(FIX / "planted.xes")
        for c in cases:
            ts = [e["ts"] for e in c["events"]]
            self.assertEqual(ts, sorted(ts), c["id"])

    def test_writes_files_matching_in_memory_result(self):
        mem, checks = parse_log(FIX / "planted.xes")
        with tempfile.TemporaryDirectory() as d:
            _, checks2 = parse_log(FIX / "planted.xes", d)
            lines = (Path(d) / "cases.jsonl").read_text(encoding="utf-8").splitlines()
            self.assertEqual([json.loads(x) for x in lines], mem)
            self.assertEqual(json.loads((Path(d) / "checks.json").read_text()), checks2)

    def test_resource_kind(self):
        self.assertEqual(resource_kind("batch_06"), "batch")
        self.assertEqual(resource_kind("user_029"), "manual")
        for other in ("NONE", "UNKNOWN", "", "batchy", "username"):
            self.assertEqual(resource_kind(other), "unclassified", other)


MINI = """<?xml version="1.0" encoding="UTF-8"?><log>
<trace><string key="concept:name" value="T1"></string>
<event><string key="User" value="user_001"></string><string key="concept:name" value="Create Purchase Order Item"></string><date key="time:timestamp" value="2018-03-01T12:00:00.000+05:00"></date></event>
<event><string key="User" value="user_001"></string><string key="concept:name" value="Record Goods Receipt"></string><date key="time:timestamp" value="2018-03-01T08:00:00.000Z"></date></event>
<event><string key="User" value="user_001"></string><string key="concept:name" value="Record Invoice Receipt"></string></event>
<event><string key="User" value="user_001"></string><string key="concept:name" value="Clear Invoice"></string><date key="time:timestamp" value="not a date"></date></event>
<event><string key="User" value="user_001"></string><string key="concept:name" value="Change Price"></string><date key="time:timestamp" value="2018-03-02T09:00:00"></date></event>
</trace></log>"""


class ParseOddTimestamps(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.TemporaryDirectory()
        self.path = Path(self.d.name) / "mini.xes"
        self.path.write_text(MINI, encoding="utf-8")

    def tearDown(self):
        self.d.cleanup()

    def test_missing_and_unreadable_dates_are_excluded_not_fatal(self):
        cases, checks = parse_log(self.path)
        self.assertEqual(checks["excluded"]["bad_date_events"], {"count": 2, "cases": ["T1"]})
        self.assertEqual([e["act"] for e in cases[0]["events"]],
                         ["Create Purchase Order Item", "Record Goods Receipt", "Change Price"])

    def test_mixed_zones_sort_by_real_time(self):
        cases, _ = parse_log(self.path)
        # 12:00+05:00 is 07:00Z, so creation comes before the 08:00Z receipt.
        self.assertEqual(cases[0]["events"][0]["ts"], "2018-03-01T07:00:00+00:00")
        self.assertEqual(cases[0]["events"][2]["ts"], "2018-03-02T09:00:00+00:00")


class Reconciliation(unittest.TestCase):
    def test_every_raw_event_is_kept_or_excluded_exactly_once(self):
        for name in ("planted.xes", "clean.xes"):
            cases, checks = parse_log(FIX / name)
            ex = checks["excluded"]
            accounted = (sum(len(c["events"]) for c in cases) + ex["bad_date_events"]["count"]
                         + ex["duplicate_events"]["count"] + ex["no_creation_cases"]["events"])
            self.assertEqual(accounted, checks["raw"]["events"], name)


if __name__ == "__main__":
    unittest.main()
