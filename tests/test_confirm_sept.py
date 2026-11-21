"""The September 2018 check (tools/confirm_sept.py, ADR 0029): outcome window, stuck lines, scoring, tests, lock.

Synthetic cases only. The June to August reproduction on the real log runs only when UNDERSTUDY_REAL_DATA=1
(it reads the data folder, which CI doesn't have)."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import confirm_sept as S  # noqa: E402


def ev(act, ts):
    return {"act": act, "ts": ts, "user": "user_001", "worth": 100.0, "kind": "manual"}


def case(cid, *events, **fields):
    c = {"id": cid, "vendor": "v1", "category": "3-way match, invoice after GR", "spend_area": "Packaging",
         "sub_spend_area": "x", "doc_type": "Standard PO", "company": "c1", "item_type": "Standard",
         "gr_flag": True, "gr_based_iv": False}
    c.update(fields)
    c["events"] = [ev(a, t) for a, t in events]
    return c


CR = ("Create Purchase Order Item", "2018-09-01T09:00:00+00:00")
IR1 = ("Record Invoice Receipt", "2018-09-10T09:00:00+00:00")


def iv(n, wrong, lo, hi):
    return {"n": n, "wrong": wrong, "error_rate": wrong / n, "boot": [lo, hi]}


class Window(unittest.TestCase):
    def test_effective_end_is_midnight_after_the_last_full_day(self):
        days = {"2019-01-16": 2204, "2019-01-17": 2312, "2019-01-18": 15, "2019-02-01": 2}
        end = S.effective_end(days)
        self.assertEqual(end.isoformat(), "2019-01-18T00:00:00+00:00")
        self.assertEqual(S.window_for("2018-09", end), 109)

    def test_window_counts_from_the_end_of_the_month(self):
        end = S.effective_end({"2018-10-31": 500})
        self.assertEqual(S.window_for("2018-09", end), 31)
        self.assertEqual(S.window_for("2018-12", S.effective_end({"2019-01-02": 500})), 2)

    def test_selection_reads_only_the_first_receipt_month(self):
        cases = [case("1_1", CR, IR1), case("1_2", CR, ("Record Invoice Receipt", "2018-10-01T00:00:00+00:00")),
                 case("2_1", ("Create Purchase Order Item", "2018-07-01T09:00:00+00:00"), IR1,
                      ("Record Invoice Receipt", "2018-10-05T00:00:00+00:00")),
                 case("3_1", CR)]
        ids, by_create = S.select(cases)
        self.assertEqual(ids, ["1_1", "2_1"])
        self.assertEqual(by_create, {"2018-07": 1, "2018-09": 1})


class Outcome(unittest.TestCase):
    def test_clean_clearing_inside_the_window_is_fine(self):
        c = case("1_1", CR, IR1, ("Clear Invoice", "2018-09-20T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "fine")
        self.assertEqual(S.outcome(c, None), "fine")

    def test_correction_before_clearing_is_wrong(self):
        c = case("1_1", CR, IR1, ("Change Price", "2018-09-12T09:00:00+00:00"), ("Clear Invoice", "2018-09-20T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "wrong")

    def test_correction_after_clearing_is_not_in_the_label(self):
        c = case("1_1", CR, IR1, ("Clear Invoice", "2018-09-20T09:00:00+00:00"), ("Change Price", "2018-09-22T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "fine")

    def test_never_cleared_is_stuck(self):
        c = case("1_1", CR, IR1, ("Record Goods Receipt", "2018-09-12T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "stuck")
        self.assertEqual(S.outcome(c, None), "stuck")

    def test_correction_before_it_got_stuck_is_wrong(self):
        c = case("1_1", CR, IR1, ("Set Payment Block", "2018-09-11T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "wrong")

    def test_clearing_after_the_window_is_stuck(self):
        c = case("1_1", CR, IR1, ("Clear Invoice", "2018-11-20T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "stuck")
        self.assertEqual(S.outcome(c, None), "fine")

    def test_correction_after_the_window_is_not_seen(self):
        c = case("1_1", CR, IR1, ("Change Price", "2018-11-01T09:00:00+00:00"), ("Clear Invoice", "2018-11-20T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "stuck")
        self.assertEqual(S.outcome(c, None), "wrong")

    def test_window_edge_is_inclusive(self):
        c = case("1_1", CR, IR1, ("Clear Invoice", "2018-10-10T09:00:00+00:00"))
        self.assertEqual(S.outcome(c, 30), "fine")
        self.assertEqual(S.outcome(c, 29), "stuck")

    def test_no_window_matches_the_study_label(self):
        from understudy.triage import triage_record
        c = case("1_1", ("Create Purchase Order Item", "2018-06-01T09:00:00+00:00"),
                 ("Record Goods Receipt", "2018-06-02T09:00:00+00:00"),
                 ("Record Invoice Receipt", "2018-06-10T09:00:00+00:00"),
                 ("Change Quantity", "2018-06-11T09:00:00+00:00"), ("Clear Invoice", "2018-06-20T09:00:00+00:00"))
        rec, _ = triage_record(c)
        self.assertEqual(rec["straight_through"], S.outcome(c, None) == "fine")
        f = S.features(c)
        self.assertEqual({k: rec[k] for k in f}, f)


class Scoring(unittest.TestCase):
    def rows(self):
        r = lambda i, po: {"id": f"{po}_{i:05d}", "category": "a", "spend_area": "b"}  # noqa: E731
        return ([(r(i, i), "fine") for i in range(90)] + [(r(i, 900), "wrong") for i in range(100, 105)]
                + [(r(i, i), "stuck") for i in range(200, 205)])

    def test_bounds(self):
        b = S.block(self.rows())
        self.assertEqual((b["paid"], b["fine"], b["wrong"], b["stuck"]), (100, 90, 5, 5))
        self.assertEqual((b["main"]["n"], b["main"]["wrong"]), (95, 5))
        self.assertEqual((b["worst"]["n"], b["worst"]["wrong"]), (100, 10))
        self.assertAlmostEqual(b["stuck_share"], 0.05)
        self.assertLess(b["worst"]["boot"][0], b["main"]["boot"][0])

    def test_per_kind_and_stuck_share_by_kind(self):
        rows = self.rows() + [({"id": "7_00001", "category": "c", "spend_area": "d"}, "stuck")]
        out = S.score(rows, lambda r: True)
        self.assertEqual(set(out["kinds"]), {"a / b", "c / d"})
        self.assertEqual(out["kinds"]["c / d"]["stuck_share"], 1.0)
        self.assertIsNone(out["kinds"]["c / d"]["main"])
        k = S.stuck_by_kind(rows)
        self.assertEqual((k["a / b"]["lines"], k["a / b"]["stuck"]), (100, 5))

    def test_shortlist_cells_need_the_bar_on_learning_months(self):
        fit = ([{"vendor": "v1", "corrections_before_invoice": 0, "gr_before_invoice": True, "straight_through": True}] * 600
               + [{"vendor": "v2", "corrections_before_invoice": 0, "gr_before_invoice": True, "straight_through": True}] * 100)
        self.assertEqual(S.shortlist_cells(fit), {("v1", False, True)})


class Readings(unittest.TestCase):
    def test_a_needs_the_lower_end_at_99(self):
        self.assertTrue(S.test_a(iv(1000, 2, 0.990, 0.999)))
        self.assertFalse(S.test_a(iv(1000, 5, 0.989, 0.999)))
        self.assertFalse(S.test_a(None))

    def test_b_held_up_worse_better(self):
        base = iv(10000, 100, 0.988, 0.992)        # error 1%, interval 0.8% to 1.2%
        self.assertEqual(S.test_b(iv(1000, 11, 0.985, 0.991), base), "held up")
        self.assertEqual(S.test_b(iv(1000, 30, 0.960, 0.985), base), "did worse")
        self.assertEqual(S.test_b(iv(1000, 2, 0.994, 0.999), base), "did better")
        self.assertIsNone(S.test_b(None, base))

    def test_unsettled_when_main_and_worst_disagree(self):
        base = {"main": iv(10000, 100, 0.988, 0.992), "worst": iv(10500, 600, 0.940, 0.950)}
        sept = {"main": iv(1000, 1, 0.993, 0.999), "worst": iv(1050, 51, 0.930, 0.960)}
        r = S.reading(sept, base)
        self.assertEqual((r["a_main"], r["a_worst"], r["a"]), (True, False, "unsettled"))
        self.assertEqual((r["b_main"], r["b_worst"], r["b"]), ("did better", "held up", "unsettled"))

    def test_settled_reading(self):
        base = {"main": iv(10000, 100, 0.988, 0.992), "worst": iv(10000, 100, 0.988, 0.992)}
        sept = {"main": iv(1000, 30, 0.960, 0.985), "worst": iv(1000, 30, 0.960, 0.985)}
        self.assertEqual(S.reading(sept, base), {"a_main": False, "a_worst": False, "a": "fail",
                                                 "b_main": "did worse", "b_worst": "did worse", "b": "did worse"})

    def test_consequences(self):
        ok = {"a": "pass", "b": "held up"}
        out = S.consequences(ok, ok)
        self.assertEqual(out["headline"], "unchanged (not proven)")
        self.assertEqual(out["page"], [{"add_line": S.PASS_LINE, "rfp_pass_marks": "unchanged"}])
        self.assertEqual(out["rfp"][0]["note"], S.HELD_NOTE)
        out = S.consequences({"a": "fail", "b": "did worse"}, {"a": "pass", "b": "did worse"})
        self.assertEqual(out["page"], [{"soften": S.WORSE_NOTE}])
        self.assertEqual(out["rfp"], [{"shortlist_requirement": S.REFIT_REQ}])
        out = S.consequences({"a": "unsettled", "b": "held up"}, {"a": "unsettled", "b": "held up"})
        self.assertEqual(out["page"], [])
        self.assertIsNone(out["rfp"][0]["note"])
        self.assertEqual(S.consequences(ok, {"a": "fail", "b": "unsettled"})["rfp"][0]["shortlist_requirement"], S.REFIT_REQ)


class Lock(unittest.TestCase):
    def test_refuses_without_a_lock(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(SystemExit) as e:
                S.check_lock(Path(d), Path(d) / "none.lock")
            self.assertIn("no lock", str(e.exception))

    def test_refuses_when_a_checksum_differs(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / S.LIST_NAME).write_text("1_1\n", encoding="utf-8")
            for p in S.LOCKED_DATA:
                (d / p).parent.mkdir(parents=True, exist_ok=True)
                (d / p).write_text("x", encoding="utf-8")
            lock = d / "t.lock"
            good = [f"{h}  {k}  {p}" for h, k, p in S.lock_entries(d)]
            meta = [f"month {S.MONTH}", f"window_days {S.WINDOW_DAYS}", "lines 1"]
            lock.write_text("\n".join(good + meta) + "\n", encoding="utf-8")
            S.check_lock(d, lock)
            (d / S.LIST_NAME).write_text("1_1\n1_2\n", encoding="utf-8")
            with self.assertRaises(SystemExit) as e:
                S.check_lock(d, lock)
            self.assertIn(S.LIST_NAME, str(e.exception))

    def test_refuses_when_the_window_differs(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / S.LIST_NAME).write_text("1_1\n", encoding="utf-8")
            for p in S.LOCKED_DATA:
                (d / p).parent.mkdir(parents=True, exist_ok=True)
                (d / p).write_text("x", encoding="utf-8")
            lock = d / "t.lock"
            good = [f"{h}  {k}  {p}" for h, k, p in S.lock_entries(d)]
            lock.write_text("\n".join(good + [f"month {S.MONTH}", "window_days 90", "lines 1"]) + "\n", encoding="utf-8")
            with self.assertRaises(SystemExit):
                S.check_lock(d, lock)

    def test_text_hash_ignores_line_endings(self):
        with tempfile.TemporaryDirectory() as d:
            a, b = Path(d) / "a.py", Path(d) / "b.py"
            a.write_bytes(b"x = 1\r\ny = 2\r\n")
            b.write_bytes(b"x = 1\ny = 2\n")
            self.assertEqual(S.sha_text(a), S.sha_text(b))


@unittest.skipUnless(os.environ.get("UNDERSTUDY_REAL_DATA") == "1", "reads the real log; set UNDERSTUDY_REAL_DATA=1")
class JuneToAugust(unittest.TestCase):
    """June to August only (already seen): no-window reproduction, and the windowed counts in the ADR."""

    def test_reproduces_and_rescores(self):
        data = S.data_dir([])
        dec, nowin, windowed = S.june_august(data)   # raises unless 26,715 / 249 and 7,532 / 23 reproduce
        got = {a: S.score(windowed, dec[a], boot=False)["pooled"] for a in S.APPROACHES}
        self.assertEqual((got["rulebook"]["paid"], got["rulebook"]["wrong"], got["rulebook"]["stuck"]), (26715, 245, 864))
        self.assertEqual((got["shortlist"]["paid"], got["shortlist"]["wrong"], got["shortlist"]["stuck"]), (7532, 23, 219))
        self.assertEqual((got["pass_everything"]["wrong"], got["pass_everything"]["stuck"]), (1695, 2270))


if __name__ == "__main__":
    unittest.main()
