import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import evidence as E  # noqa: E402


def ev(act, ts="2018-06-01T10:00"):
    return {"act": act, "ts": ts, "kind": "manual", "user": "user_001"}


class Clustering(unittest.TestCase):
    def test_one_line_per_order_has_no_design_effect(self):
        ids = [f"{i}_00001" for i in range(1000)]
        wrong = set(ids[:10])
        self.assertAlmostEqual(E.design_effect(E.clusters(ids, wrong)), 1.0, delta=0.01)

    def test_mistakes_on_one_order_raise_it(self):
        ids = [f"{i}_00001" for i in range(990)] + [f"9999_{j:05d}" for j in range(10)]
        wrong = {i for i in ids if i.startswith("9999_")}
        cl = E.clusters(ids, wrong)
        self.assertGreater(E.design_effect(cl), 5)
        self.assertLess(E.clustered_lower(cl), E.clustering(ids, wrong)["lower"])

    def test_supplier_clusters_widen_the_bound(self):
        # 1,000 lines on 20 suppliers; all 10 mistakes on one supplier: the supplier-level bound is lower.
        rows = [{"id": f"{i}_00001", "vendor": f"v{i % 20}"} for i in range(1000)]
        wrong = {r["id"] for r in rows if r["vendor"] == "v3"}
        wrong = set(sorted(wrong)[:10])
        out = E.vendor_clustering(rows, wrong)
        self.assertEqual((out["n"], out["wrong"], out["vendors"]), (1000, 10, 20))
        self.assertGreater(out["deff"], 1.5)
        self.assertLess(out["clustered_lower"], E.clustering([r["id"] for r in rows], wrong)["lower"])

    def test_bootstrap_is_repeatable(self):
        cl = E.clusters([f"{i % 50}_{i:05d}" for i in range(500)], {"3_00003", "7_00007"})
        self.assertEqual(E.po_bootstrap(cl, draws=200), E.po_bootstrap(cl, draws=200))


class Label(unittest.TestCase):
    def test_scan(self):
        cases = [
            {"id": "1_1", "events": [ev("Record Invoice Receipt"), ev("Change Delivery Indicator"), ev("Clear Invoice")]},
            {"id": "2_1", "events": [ev("Record Invoice Receipt"), ev("Change Price"), ev("Change Delivery Indicator"), ev("Clear Invoice")]},
            {"id": "3_1", "events": [ev("Record Invoice Receipt"), ev("Clear Invoice"), ev("Change Quantity")]},
            {"id": "4_1", "events": [ev("Record Invoice Receipt"), ev("Clear Invoice"), ev("Record Invoice Receipt"), ev("Change Price")]},
            {"id": "5_1", "events": [ev("Record Invoice Receipt"), ev("Change Price"), ev("Clear Invoice")]},  # not paid
        ]
        s = E.label_scan(cases, {"1_1", "2_1", "3_1", "4_1"}, {"1_1", "2_1"})
        self.assertEqual(s["cdi_only"], ["1_1"])
        self.assertEqual(s["mix"], {"Change Delivery Indicator": 2, "Change Price": 1})
        self.assertEqual((s["post_clear"], s["post_clear_multi_ir"]), (2, 1))
        sens = E.sensitivity(["1_1", "2_1", "3_1", "4_1"], {"1_1", "2_1"}, s)
        self.assertEqual(sens["drop_cdi"]["wrong"], 1)
        self.assertLess(sens["post_clear_lower"], sens["post_clear_single_lower"])


class Vendor(unittest.TestCase):
    def test_panel_picks_highest_fit_coverage(self):
        row = lambda i, v, ok, split: {"id": f"{i}_1", "vendor": v, "corrections_before_invoice": 0, "gr_before_invoice": True,  # noqa: E731
                                       "category": "c", "spend_area": "s", "straight_through": ok, "split": split}
        fit = [row(i, "good", True, "fit") for i in range(600)] + [row(1000 + i, "bad", i % 5 > 0, "fit") for i in range(600)]
        held = [row(5000 + i, "good", True, "heldout") for i in range(100)] + [row(6000 + i, "bad", True, "heldout") for i in range(100)]
        p = E.vendor_panel(fit, held)
        top = next(r for r in p["rows"] if r["key"] == p["picked"])
        self.assertEqual(top["passed"], 100)
        self.assertEqual(top["vendors"], 1)


class Replay(unittest.TestCase):
    def test_errors_by_kind_and_order(self):
        by_id = {f"{po}_{j}": {"id": f"{po}_{j}", "straight_through": ok, "category": "k", "spend_area": "x"}
                 for po, j, ok in [(1, 1, False), (1, 2, False), (2, 1, False), (3, 1, True)]}
        r = E.replay_errors([{"id": i} for i in by_id], by_id)
        self.assertEqual((r["wrong"], r["kinds"], r["top_order"], r["orders"], r["orders_paid"]), (3, 1, 2, 2, 3))


if __name__ == "__main__":
    unittest.main()
