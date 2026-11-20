import unittest

from understudy.replay import all_weeks, replay, reviewer, week

# ISO weeks in 2018: W23 starts Mon 06-04, W24 06-11, W25 06-18, W26 06-25, W27 07-02, W30 07-23.
DAY = {23: "2018-06-05", 24: "2018-06-12", 25: "2018-06-19", 26: "2018-06-26", 27: "2018-07-03", 30: "2018-07-24"}


def batch(prefix, n, cat, arrive, clear, bad=0, touches=1):
    recs, timing = [], {}
    for i in range(n):
        rid = f"{prefix}{i:04d}"
        recs.append({"id": rid, "category": cat, "spend_area": "S", "straight_through": i >= bad})
        timing[rid] = {"invoice_ts": f"{DAY[arrive]}T10:00:00+00:00", "clear_ts": f"{DAY[clear]}T10:00:00+00:00",
                       "manual_touches": touches}
    return recs, timing


def merge(*parts):
    recs, timing = [], {}
    for r, t in parts:
        recs += r
        timing.update(t)
    return recs, timing


class Weeks(unittest.TestCase):
    def test_week_labels_and_no_gaps(self):
        self.assertEqual(week("2018-06-05T10:00:00+00:00"), "2018-W23")
        self.assertEqual(all_weeks(["2018-W26", "2018-W23"]), ["2018-W23", "2018-W24", "2018-W25", "2018-W26"])
        self.assertEqual(all_weeks(["2018-W52", "2019-W01"]), ["2018-W52", "2019-W01"])


class OutcomeGate(unittest.TestCase):
    def test_promotion_waits_for_outcomes_then_acts(self):
        recs, timing = merge(batch("x", 400, "X", 23, 25), batch("y", 100, "X", 26, 27))
        res = replay(recs, timing, lambda r: True)
        self.assertEqual(res["first_promotion"], "2018-W25")   # not W23: outcomes land in W25
        self.assertEqual(res["totals"], {"passed": 100, "wrong": 0, "touches_removed": 100})
        w23 = next(t for t in res["timeline"] if t["week"] == "2018-W23")
        self.assertEqual(w23["autonomous_types"], 0)

    def test_380_clean_is_not_enough(self):
        recs, timing = batch("x", 380, "X", 23, 24)
        self.assertIsNone(replay(recs, timing, lambda r: True)["first_promotion"])

    def test_demotion_after_bad_run(self):
        # After promotion in W24: 10 bad invoices resolve in W26, 190 clean ones in W27.
        # The window needs 200 resolved calls, so demotion comes in W27, not W26.
        recs, timing = merge(batch("a", 381, "Y", 23, 24), batch("b", 10, "Y", 25, 26, bad=10),
                             batch("c", 190, "Y", 25, 27, touches=2))
        res = replay(recs, timing, lambda r: True)
        kinds = [(e["event"], e["week"]) for e in res["events"]]
        self.assertEqual(kinds, [("promoted", "2018-W24"), ("demoted", "2018-W27")])
        self.assertEqual(res["totals"]["wrong"], 10)
        self.assertEqual(res["totals"]["passed"], 200)
        self.assertEqual(res["totals"]["touches_removed"], 380)

    def test_log_lists_autonomous_passes_without_changing_results(self):
        recs, timing = merge(batch("a", 381, "Y", 23, 24), batch("b", 10, "Y", 25, 26, bad=10),
                             batch("c", 190, "Y", 25, 27, touches=2))
        log = []
        with_log = replay(recs, timing, lambda r: True, log=log)
        self.assertEqual(with_log, replay(recs, timing, lambda r: True))
        self.assertEqual(len(log), with_log["totals"]["passed"])
        self.assertEqual(sum(not x["correct"] for x in log), with_log["totals"]["wrong"])

    def test_leave_to_person_calls_are_not_evidence(self):
        recs, timing = batch("x", 400, "X", 23, 24)
        self.assertIsNone(replay(recs, timing, lambda r: False)["first_promotion"])

    def test_types_are_independent(self):
        recs, timing = merge(batch("x", 400, "X", 23, 24), batch("z", 400, "Z", 23, 24, bad=20))
        res = replay(recs, timing, lambda r: True)
        self.assertEqual(res["promoted_types"], ["X / S"])


class AgreementGate(unittest.TestCase):
    def test_full_anchoring_promotes_a_bad_helper_early(self):
        recs, timing = batch("z", 381, "Z", 23, 30, bad=20)   # 361/381 correct: lower bound 0.920
        always = reviewer(alpha=1.0)
        agr = replay(recs, timing, lambda r: True, gate="agreement", agree=always)
        out = replay(recs, timing, lambda r: True, gate="outcome")
        self.assertEqual(agr["first_promotion"], "2018-W23")
        self.assertIsNone(out["first_promotion"])

    def test_no_anchoring_reviewer_catches_exceptions(self):
        recs, timing = batch("z", 381, "Z", 23, 30, bad=20)
        honest = reviewer(alpha=0.0, catch=1.0, false_flag=0.0)
        res = replay(recs, timing, lambda r: True, gate="agreement", agree=honest)
        self.assertIsNone(res["first_promotion"])

    def test_reviewer_is_reproducible(self):
        a, b = reviewer(0.7, seed=5), reviewer(0.7, seed=5)
        self.assertEqual([a(i % 3 == 0) for i in range(200)], [b(i % 3 == 0) for i in range(200)])


if __name__ == "__main__":
    unittest.main()


class ControlHooks(unittest.TestCase):
    """Optional hooks for the pilot request's controls (ADR 0025); unset, the replay is unchanged."""

    def test_promote_hook_can_require_looks_in_a_row(self):
        from understudy.evaluate import wilson
        recs, timing = merge(batch("x", 400, "X", 23, 24), batch("y", 100, "X", 26, 27))
        streak = {}

        def two_in_a_row(t, settled, w):
            lo = wilson(sum(c for c, _ in settled), len(settled))[0]
            ok = lo is not None and lo >= 0.99
            streak[t] = streak.get(t, 0) + 1 if ok else 0
            return streak[t] >= 2
        self.assertEqual(replay(recs, timing, lambda r: True)["first_promotion"], "2018-W24")
        self.assertEqual(replay(recs, timing, lambda r: True, promote=two_in_a_row)["first_promotion"], "2018-W25")

    def test_order_cap_sends_later_lines_of_one_order_to_a_person(self):
        recs, timing = merge(batch("x", 400, "X", 23, 24), batch("PO9_", 10, "X", 26, 27))
        self.assertEqual(replay(recs, timing, lambda r: True)["totals"]["passed"], 10)
        self.assertEqual(replay(recs, timing, lambda r: True, order_cap=3)["totals"]["passed"], 3)

    def test_looks_count_shadow_weeks_with_settled_calls(self):
        recs, timing = batch("x", 380, "X", 23, 25)
        res = replay(recs, timing, lambda r: True)
        self.assertEqual((res["looks"], res["looked_types"]), (1, 1))   # W23, W24: nothing settled yet; W25: one look
