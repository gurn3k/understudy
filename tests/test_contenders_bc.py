import json
import tempfile
import unittest
from pathlib import Path

from understudy import contender_b as B
from understudy import contender_c as C
from understudy.claude_call import Caller, StopRun, api_equivalent_cost, extract_json
from understudy.evaluate import evaluate
from understudy.parse import parse_log
from understudy.triage import build_triage

FIX = Path(__file__).parent / "fixtures"


def triage_records():
    cases, _ = parse_log(FIX / "triage.xes")
    recs, _ = build_triage(cases)
    return recs


class GateB(unittest.TestCase):
    ids = ["a", "b", "c"]

    def test_valid_reply(self):
        out, issues = B.gate(self.ids, {"decisions": [
            {"id": "a", "decision": "straight_through"}, {"id": "b", "decision": "leave_to_person"},
            {"id": "c", "decision": "straight_through"}]})
        self.assertEqual(out, {"a": True, "b": False, "c": True})
        self.assertEqual(issues, [])

    def test_fails_closed(self):
        out, issues = B.gate(self.ids, {"decisions": [
            {"id": "a", "decision": "approve"},                 # not an allowed value
            {"id": "zzz", "decision": "straight_through"},      # not in the batch
            {"id": "b", "decision": "straight_through"},
            {"id": "b", "decision": "straight_through"},        # duplicate
            "junk"]})
        self.assertEqual(out, {"a": False, "b": False, "c": False})
        self.assertEqual(len(issues), 5)  # bad value, unknown id, duplicate, non-object, missing c

    def test_unparseable_reply_leaves_all_to_person(self):
        for reply in (None, [], {"decision": "x"}, {"decisions": "all"}):
            out, issues = B.gate(self.ids, reply)
            self.assertEqual(set(out.values()), {False})
            self.assertTrue(issues)

    def test_facts_carry_no_outcome(self):
        recs = triage_records()
        ctx = B.context([r for r in recs if r["split"] == "fit"])
        for r in recs:
            f = B.facts(r, ctx)
            self.assertNotIn("straight_through", f)
            self.assertNotIn("split", f)

    def test_vendor_history_needs_20(self):
        recs = triage_records()
        ctx = B.context([r for r in recs if r["split"] == "fit"])
        self.assertIsNone(B.facts(recs[0], ctx)["vendor_history"])


class PolicyC(unittest.TestCase):
    def test_validate_catches_bad_policies(self):
        bad = [
            None, {}, {"rules": []},
            {"rules": [{"if": [{"field": "straight_through", "op": "eq", "value": True}]}]},  # label as a field
            {"rules": [{"if": [{"field": "id", "op": "in", "value": ["T04_00001"]}]}]},      # case ids
            {"rules": [{"if": [{"field": "vendor", "op": "regex", "value": ".*"}]}]},
            {"rules": [{"if": [{"field": "vendor", "op": "ge", "value": 3}]}]},
            {"rules": [{"if": [{"field": "gr_before_invoice", "op": "eq", "value": 1}]}]},
            {"rules": [{"if": [{"field": "vendor", "op": "eq", "value": "v"}]}], "default": "straight_through"},
        ]
        for p in bad:
            self.assertTrue(C.validate(p), p)

    def test_validate_accepts_good_policy(self):
        p = {"rules": [{"if": [{"field": "corrections_before_invoice", "op": "le", "value": 0},
                               {"field": "vendor", "op": "in", "value": ["vendor_A"]},
                               {"field": "invoice_value", "op": "ge", "value": 10}]}]}
        self.assertEqual(C.validate(p), [])

    def test_decider_hand_worked(self):
        recs = {r["id"]: r for r in triage_records()}
        p = {"rules": [{"if": [{"field": "vendor", "op": "eq", "value": "vendor_A"},
                               {"field": "corrections_before_invoice", "op": "le", "value": 0}]},
                       {"if": [{"field": "case_type", "op": "eq", "value": "3-way match, invoice before GR / Packaging"},
                               {"field": "invoice_value", "op": "ge", "value": 100}]}]}
        d = C.decider(p)
        # T04: vendor_A, no corrections -> rule 1. T07: vendor_A but 1 correction -> no.
        # T10: vendor_B, IBG/Packaging, value 100 -> rule 2. T05: vendor_B, value 50 -> no.
        self.assertEqual({i: d(recs[i]) for i in ("T04_00001", "T07_00001", "T10_00001", "T05_00001")},
                         {"T04_00001": True, "T07_00001": False, "T10_00001": True, "T05_00001": False})

    def test_aggregates_contain_no_case_ids(self):
        recs = triage_records()
        text = json.dumps(C.aggregates([r for r in recs if r["split"] == "fit"]))
        for r in recs:
            self.assertNotIn(r["id"], text)

    def test_choose_skips_invalid_and_needs_the_bar(self):
        recs = triage_records()
        fit = [r for r in recs if r["split"] == "fit"]
        idx, summary = C.choose([None, C.stub_policy("")], fit)
        self.assertIsNone(idx)  # the stub passes nothing in the fixture, so it can't meet the bar
        self.assertFalse(summary[0]["valid"])


class CallerModes(unittest.TestCase):
    def test_stub_end_to_end_with_eval(self):
        recs = triage_records()
        fit = [r for r in recs if r["split"] == "fit"]
        held = [r for r in recs if r["split"] == "heldout"]
        with tempfile.TemporaryDirectory() as d:
            caller = Caller("stub", d, B.SYSTEM, stub_fn=B.stub_reply)
            dec, log = B.run(held, B.context(fit), caller)
        self.assertEqual(set(dec), {r["id"] for r in held})
        res = evaluate(held, lambda r: dec[r["id"]])
        self.assertEqual(res["pooled"]["invoices"], len(held))
        self.assertTrue(all(row["issues"] == [] for row in log))

    def test_replay_reads_saved_and_refuses_missing(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "k1.json").write_text(json.dumps({"reply": {"x": 1}, "raw": "", "meta": {}}))
            c = Caller("replay", d, "sys")
            self.assertEqual(c.ask("k1", "p")["reply"], {"x": 1})
            with self.assertRaises(FileNotFoundError):
                c.ask("k2", "p")

    def test_live_cap_stops_before_calling(self):
        from understudy.claude_call import CallCap
        with tempfile.TemporaryDirectory() as d:
            c = Caller("live", d, "sys", max_live_calls=0)
            with self.assertRaises(CallCap):
                c.ask("k", "p")

    def test_extract_json_and_cost(self):
        self.assertEqual(extract_json('text {"a": [1]} tail'), {"a": [1]})
        self.assertIsNone(extract_json("no json"))
        self.assertIsNone(extract_json(""))
        cost = api_equivalent_cost({"input_tokens": 2, "cache_creation_input_tokens": 12668 + 1000,
                                    "output_tokens": 500})
        self.assertEqual(cost["input_tokens"], 1002)
        self.assertAlmostEqual(cost["usd"], 1002 / 1e6 * 4 + 500 / 1e6 * 20)
        self.assertTrue(issubclass(StopRun, Exception))


if __name__ == "__main__":
    unittest.main()
