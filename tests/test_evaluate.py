import unittest

from understudy.contenders import fit_rule_a, pass_everything, rule_a
from understudy.evaluate import Z, evaluate, verdict, wilson


def rec(i, st, split="heldout", cat="X", spend="S", corr=0, gr=True):
    return {"id": f"r{i}", "straight_through": st, "split": split, "category": cat,
            "spend_area": spend, "corrections_before_invoice": corr, "gr_before_invoice": gr}


class Wilson(unittest.TestCase):
    def test_all_correct_has_closed_form(self):
        lo, hi = wilson(381, 381)
        self.assertAlmostEqual(lo, 381 / (381 + Z * Z), places=12)
        self.assertAlmostEqual(hi, 1.0, places=12)

    def test_zero_successes_upper_closed_form(self):
        _, hi = wilson(0, 50)
        self.assertAlmostEqual(hi, Z * Z / (50 + Z * Z), places=12)

    def test_empty(self):
        self.assertEqual(wilson(0, 0), (None, None))

    def test_verdict_edges(self):
        self.assertEqual(verdict(381, 381), "helper-ready")         # lower bound 0.99002
        self.assertEqual(verdict(380, 380), "not enough evidence")  # lower bound 0.98999
        self.assertEqual(verdict(398, 400), "not ready")            # lower bound 0.98196
        self.assertEqual(verdict(0, 0), "not enough evidence")


class Evaluate(unittest.TestCase):
    def test_hand_worked_block(self):
        recs = [rec(1, True), rec(2, False), rec(3, True), rec(4, False)]
        res = evaluate(recs, lambda r: r["id"] in {"r1", "r2"})
        p = res["pooled"]
        self.assertEqual(p["precision"], [1, 2])
        self.assertEqual(p["coverage"], [2, 4])
        self.assertEqual(p["recall"], [1, 2])
        self.assertEqual(p["wrong_ids"], ["r2"])
        self.assertEqual(p["passed_ids"], ["r1", "r2"])
        self.assertEqual(p["coverage_at_bar"], 0.0)
        self.assertEqual(list(res["types"]), ["X / S"])

    def test_leave_everything_is_zero_coverage_not_perfect_precision(self):
        res = evaluate([rec(i, True) for i in range(500)], lambda r: False)
        p = res["pooled"]
        self.assertEqual(p["calls"], 0)
        self.assertIsNone(p["precision_lower"])
        self.assertEqual(p["verdict"], "not enough evidence")
        self.assertEqual(p["coverage_at_bar"], 0.0)

    def test_coverage_at_bar_when_it_passes(self):
        recs = [rec(i, True) for i in range(400)] + [rec(1000 + i, False) for i in range(100)]
        res = evaluate(recs, lambda r: r["straight_through"])  # a perfect helper
        self.assertEqual(res["pooled"]["coverage_at_bar"], 400 / 500)

    def test_always_wrong_helper_fails(self):
        recs = [rec(i, False) for i in range(500)]
        self.assertEqual(evaluate(recs, pass_everything)["pooled"]["verdict"], "not ready")


class RuleA(unittest.TestCase):
    def fit_set(self):
        recs = []
        recs += [rec(i, True, "fit", cat="X") for i in range(400)]                       # passes
        recs += [rec(1000 + i, i >= 2, "fit", cat="Y") for i in range(400)]                # 398/400 fails
        recs += [rec(2000 + i, True, "fit", cat="Z") for i in range(100)]                  # too few
        recs += [rec(3000 + i, True, "heldout", cat="Y") for i in range(1000)]             # must be ignored
        return recs

    def test_cells(self):
        passing, stats = fit_rule_a(self.fit_set())
        self.assertEqual(passing, {("X / S", False, True)})
        self.assertEqual(stats[("Y / S", False, True)], [398, 400])

    def test_cell_splits_on_corrections_and_receipt(self):
        passing, _ = fit_rule_a(self.fit_set())
        a = rule_a(passing)
        self.assertTrue(a(rec(1, True, cat="X")))
        self.assertFalse(a(rec(2, True, cat="X", corr=1)))
        self.assertFalse(a(rec(3, True, cat="X", gr=False)))
        self.assertFalse(a(rec(4, True, cat="unseen")))


if __name__ == "__main__":
    unittest.main()


class Sample(unittest.TestCase):
    def test_size_proportions_and_repeatability(self):
        from understudy.sample import stratified
        recs = ([rec(i, True, cat="A") for i in range(700)] + [rec(1000 + i, True, cat="B") for i in range(299)]
                + [rec(2000, True, cat="C")])
        s1 = stratified(recs, size=100, seed=1)
        s2 = stratified(recs, size=100, seed=1)
        self.assertEqual(len(s1), 100)
        self.assertEqual([r["id"] for r in s1], [r["id"] for r in s2])
        counts = {c: sum(1 for r in s1 if r["category"] == c) for c in "ABC"}
        self.assertEqual(counts, {"A": 70, "B": 30, "C": 0})  # 70.0, 29.9, 0.1 -> largest remainder
        self.assertEqual(len({r["id"] for r in s1}), 100)
