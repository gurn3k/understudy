import copy
import importlib.util
import unittest
from pathlib import Path

from understudy.analyse import analyse
from understudy.parse import parse_log

ROOT = Path(__file__).parent.parent
FIX = Path(__file__).parent / "fixtures"
spec = importlib.util.spec_from_file_location("recount", ROOT / "tools" / "recount.py")
recount = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recount)


class RecountAgreesAndCatches(unittest.TestCase):
    def published(self, name):
        cases, checks = parse_log(FIX / name)
        return checks, analyse(cases)

    def test_recount_matches_on_both_fixtures(self):
        for name in ("planted.xes", "clean.xes"):
            checks, an = self.published(name)
            self.assertEqual(recount.compare(recount.recount(FIX / name), checks, an), [], name)

    def test_recount_catches_a_changed_figure(self):
        checks, an = self.published("planted.xes")
        rc = recount.recount(FIX / "planted.xes")
        for mutate in (
            lambda a, c: a["activities"]["Change Price"].__setitem__("manual", 1),
            lambda a, c: a["activities"]["Remove Payment Block"].__setitem__("repeat", [1, 5]),
            lambda a, c: a["flagged"]["block_removed_before_goods_receipt"].__setitem__("by_batch", 2),
            lambda a, c: c["excluded"]["duplicate_events"].__setitem__("count", 0),
            lambda a, c: a["kept"].__setitem__("events", 43),
            lambda a, c: a["activities"].pop("Vendor creates invoice"),
        ):
            a2, c2 = copy.deepcopy(an), copy.deepcopy(checks)
            mutate(a2, c2)
            self.assertNotEqual(recount.compare(rc, c2, a2), [])


if __name__ == "__main__":
    unittest.main()
