import json
import unittest
from pathlib import Path

from understudy.candidates import balanced_accuracy, fit_lookup, rank, rule_likeness
from understudy.parse import parse_log
from understudy.triage import build_triage, fit_rates, is_corrective

FIX = Path(__file__).parent / "fixtures"
KEY = json.loads((FIX / "triage_key.json").read_text(encoding="utf-8"))


class TriageLabels(unittest.TestCase):
    def setUp(self):
        cases, _ = parse_log(FIX / "triage.xes")
        self.records, self.unlabelled = build_triage(cases)
        self.by_id = {r["id"]: r for r in self.records}

    def test_labels_match_key(self):
        self.assertEqual(set(self.by_id), set(KEY["labels"]))
        for cid, want in KEY["labels"].items():
            for k, v in want.items():
                self.assertEqual(self.by_id[cid][k], v, f"{cid} {k}")

    def test_unlabelled_reasons_match_key(self):
        self.assertEqual(self.unlabelled, KEY["unlabelled"])

    def test_vendor_rates_use_fit_months_only(self):
        rates = fit_rates(self.records, "vendor")
        self.assertEqual({k: list(v) for k, v in rates.items()}, KEY["vendor_fit_rate"])

    def test_no_future_facts_in_record(self):
        allowed = {"id", "split", "invoice_value", "gr_before_invoice", "corrections_before_invoice",
                   "invoice_before_creation", "straight_through", "category", "doc_type",
                   "spend_area", "sub_spend_area", "vendor", "company", "item_type",
                   "gr_flag", "gr_based_iv"}
        for r in self.records:
            self.assertEqual(set(r), allowed)

    def test_corrective_set(self):
        for a in ("Change Price", "Cancel Invoice Receipt", "Vendor creates debit memo", "Set Payment Block"):
            self.assertTrue(is_corrective(a), a)
        for a in ("Remove Payment Block", "Record Goods Receipt", "Record Invoice Receipt", "Clear Invoice"):
            self.assertFalse(is_corrective(a), a)


class RuleLikeness(unittest.TestCase):
    def test_balanced_accuracy_hand_worked(self):
        self.assertEqual(balanced_accuracy([1, 1, 0, 0], [1, 0, 0, 0]), 0.75)
        self.assertEqual(balanced_accuracy([1, 1, 0, 0], [1, 1, 1, 1]), 0.5)
        self.assertIsNone(balanced_accuracy([1, 1], [1, 0]))

    def test_lookup_rule_and_unseen_value(self):
        recs = ([{"split": "fit", "f": "a", "y": True}] * 3 + [{"split": "fit", "f": "b", "y": False}] * 3
                + [{"split": "heldout", "f": "a", "y": True}, {"split": "heldout", "f": "b", "y": False},
                   {"split": "heldout", "f": "zzz", "y": False}])
        rule = fit_lookup(recs, "f", "y")
        self.assertTrue(rule({"f": "a"}))
        self.assertFalse(rule({"f": "b"}))
        self.assertFalse(rule({"f": "zzz"}))  # base rate 0.5 is not > 0.5
        self.assertEqual(rule_likeness(recs, ["f"], "y"), (1.0, "f"))

    def test_field_is_chosen_on_fit_months_not_heldout(self):
        # Field g fits the earlier months perfectly but fails on held-out; f is the reverse.
        recs = ([{"split": "fit", "f": "x", "g": "a", "y": True}, {"split": "fit", "f": "x", "g": "b", "y": False}]
                + [{"split": "heldout", "f": "p", "g": "b", "y": True}, {"split": "heldout", "f": "q", "g": "a", "y": False}])
        score, field = rule_likeness(recs, ["f", "g"], "y")
        self.assertEqual(field, "g")
        self.assertEqual(score, 0.0)

    def test_rank_excludes_already_automated(self):
        recs = ([{"split": "fit", "f": "a", "y": True}, {"split": "fit", "f": "b", "y": False}]
                + [{"split": "heldout", "f": "a", "y": True}, {"split": "heldout", "f": "b", "y": False}])
        analysis = {"activities": {"Mostly batch": {"manual": 10, "batch": 90},
                                   "Mostly people": {"manual": 50, "batch": 5}}}
        out = rank([
            {"name": "big but automated", "volume_activities": ["Mostly batch"], "records": recs, "fields": ["f"], "label": "y"},
            {"name": "manual", "volume_activities": ["Mostly people"], "records": recs, "fields": ["f"], "label": "y"},
        ], analysis)
        self.assertEqual(out[0]["name"], "manual")
        self.assertTrue(out[1]["excluded_already_automated"])
        self.assertEqual(out[1]["score"], 0.0)


if __name__ == "__main__":
    unittest.main()
