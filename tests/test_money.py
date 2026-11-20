import importlib.util
import unittest
from pathlib import Path

from understudy.evaluate import wilson

ROOT = Path(__file__).parent.parent
spec = importlib.util.spec_from_file_location("money", ROOT / "tools" / "money.py")
money = importlib.util.module_from_spec(spec)
spec.loader.exec_module(money)


def ev(act, minute, user="user_001", kind="manual"):
    return {"act": act, "ts": f"2018-06-01T10:{minute:02d}:00+00:00", "user": user, "kind": kind}


def line(cid, *between, receipt_minute=0, clear_minute=59, clear_user="user_002"):
    return {"id": cid, "events": [ev("Record Invoice Receipt", receipt_minute, kind="batch", user="batch_00"),
                                  *between, ev("Clear Invoice", clear_minute, user=clear_user)]}


class Footprint(unittest.TestCase):
    def setUp(self):
        # Twelve lines cleared by one user in one minute (a bulk posting). Line 1 also has a lone manual price
        # change; line 2 a manual block release that is part of a bulk group; line 3 a lone block release.
        bulk_rpb = [ev("Remove Payment Block", 30, user="user_009") for _ in range(10)]
        self.cases = [
            line("P1_00001", ev("Change Price", 5)),
            line("P1_00002", bulk_rpb[0]),
            line("P2_00001", ev("Remove Payment Block", 31, user="user_003"), receipt_minute=1),
        ] + [line(f"P{i}_00001", bulk_rpb[i - 2]) for i in range(3, 12)]
        self.cases.append({"id": "P99_00001", "events": [ev("Record Invoice Receipt", 0, kind="batch")]})  # never cleared
        self.held = {c["id"] for c in self.cases}
        self.paid = {"P1_00001", "P1_00002", "P2_00001", "P3_00001"}

    def test_counts(self):
        fp = money.footprint(iter(self.cases), self.paid, self.held)
        self.assertEqual(fp["paid_lines"], 4)
        self.assertEqual(fp["held_lines"], 12)  # the never-cleared line has no window
        self.assertEqual(fp["isolated_paid"], 2)  # the lone price change and the lone release; bulk steps don't count
        self.assertEqual(fp["isolated_paid_lt5"], 2)
        self.assertEqual(fp["any_manual_paid"], 4)  # every paid line has some manual step besides the clearing
        self.assertEqual(fp["rpb_manual_paid"], 3)
        self.assertEqual(fp["rpb_manual_held"], 11)
        self.assertEqual(fp["groups_paid"], 3)  # P1 shares one receipt minute across its two lines
        self.assertEqual(fp["groups_held"], 11)

    def test_bulk_clearing_is_not_a_footprint(self):
        fp = money.footprint(iter(self.cases), {"P3_00001"}, self.held)
        self.assertEqual(fp["isolated_paid"], 0)

    def test_a_small_group_is_isolated(self):
        # Shrink the bulk release group below the threshold: now it counts.
        cases = [c for c in self.cases if c["id"] in {"P1_00002", "P3_00001"}]
        fp = money.footprint(iter(cases), {"P1_00002"}, {c["id"] for c in cases})
        self.assertEqual(fp["isolated_paid"], 1)


class Rates(unittest.TestCase):
    def test_lines_per_mistake(self):
        point, cautious, generous = money.lines_per_mistake(844, 15)
        self.assertAlmostEqual(point, 844 / 15)
        lo, hi = wilson(829, 844)
        self.assertAlmostEqual(cautious, 1 / (1 - lo))
        self.assertAlmostEqual(generous, 1 / (1 - hi))
        self.assertLess(cautious, point)
        self.assertLess(point, generous)

    def test_switch_off(self):
        self.assertEqual(money.switch_off_threshold(200), 5)
        self.assertLess(wilson(195, 200)[1], 0.99)
        self.assertGreaterEqual(wilson(196, 200)[1], 0.99)
        self.assertAlmostEqual(money.switch_off_power(200, 0.02), 0.37, places=2)
        self.assertAlmostEqual(money.switch_off_power(400, 0.02), 0.55, places=2)

    def test_blind_sample(self):
        n = money.blind_sample(q=0.02, power=0.8)
        self.assertEqual(n % 50, 0)
        self.assertGreaterEqual(money.switch_off_power(n, 0.02), 0.8)
        self.assertTrue(all(money.switch_off_power(m, 0.02) < 0.8 for m in range(50, n, 50)))

    def test_first_powered(self):
        n = money.first_powered(0.02, 0.8)
        self.assertGreaterEqual(money.switch_off_power(n, 0.02), 0.8)
        self.assertTrue(all(money.switch_off_power(m, 0.02) < 0.8 for m in range(n - 20, n)))
        self.assertLessEqual(n, money.blind_sample(q=0.02, power=0.8))

    def test_value_anchors(self):
        paid = list(range(1, 11))  # tenth line is 10
        a = money.value_anchors(paid, [2, 4, 10])
        self.assertEqual(a["line"], 10)
        self.assertAlmostEqual(a["mean_wrong"], 16 / 3)
        self.assertAlmostEqual(a["mean_wrong_below_top10"], 3)
        self.assertEqual(a["wrong_below_top10"], 2)


if __name__ == "__main__":
    unittest.main()
