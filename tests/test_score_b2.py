"""The follow-up scoring follows ADR 0018: three outcomes, the B-against-C rule, and the B-against-A rule."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import score_b2 as S  # noqa: E402


def recs(n_pass_right, n_pass_wrong, n_held):
    rows, dec = [], {}
    for i in range(n_pass_right + n_pass_wrong + n_held):
        rid = f"r{i}"
        rows.append({"id": rid, "straight_through": i < n_pass_right or i >= n_pass_right + n_pass_wrong,
                     "case_type": "x"})
        dec[rid] = i < n_pass_right + n_pass_wrong
    return rows, dec


class Outcomes(unittest.TestCase):
    def test_proved_with_enough_clean_passes(self):
        rows, dec = recs(563 - 1, 1, 100)
        self.assertEqual(S.b_alone(rows, dec)["outcome"], "proved")

    def test_not_proved_when_too_few(self):
        rows, dec = recs(87, 1, 1400)
        self.assertEqual(S.b_alone(rows, dec)["outcome"], "not_proved")

    def test_below_bar_when_even_best_case_is_under(self):
        rows, dec = recs(560, 40, 100)
        self.assertEqual(S.b_alone(rows, dec)["outcome"], "below_bar")


class Comparisons(unittest.TestCase):
    def test_b_cannot_beat_a_below_ten_percent_coverage(self):
        self.assertFalse(S.b_vs_a({"coverage": 0.06, "outcome": "proved"}))
        self.assertTrue(S.b_vs_a({"coverage": 0.10, "outcome": "proved"}))
        self.assertFalse(S.b_vs_a({"coverage": 0.50, "outcome": "not_proved"}))

    def test_fewer_passes_means_b_cannot_win(self):
        rows = [{"id": f"r{i}", "straight_through": i >= 20} for i in range(200)]
        b = {r["id"]: r["id"] in {f"r{i}" for i in range(30, 60)} for r in rows}
        c_ids = {f"r{i}" for i in range(0, 120)}
        res = S.b_vs_c(rows, b, lambda r: r["id"] in c_ids)
        self.assertEqual((res["B_only"], res["C_only"]), (0, 20))
        self.assertEqual(res["winner"], "not_separated")


if __name__ == "__main__":
    unittest.main()
