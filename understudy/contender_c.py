"""Contender C: Claude writes a triage policy; code checks it and runs it.

Claude sees only aggregate tables from the earlier months, never a single
held-out invoice. The policy is a small JSON rule language:

{"rules": [{"if": [{"field": "...", "op": "eq|ne|in|ge|le", "value": ...}, ...],
            "why": "..."}],
 "default": "leave_to_person"}

An invoice goes straight through when every condition of at least one rule holds.
"""
import json
from collections import defaultdict

from understudy.contenders import cell
from understudy.evaluate import BAR, case_type, evaluate, wilson

FIELDS = {
    "case_type": str, "category": str, "spend_area": str, "sub_spend_area": str,
    "doc_type": str, "item_type": str, "company": str, "vendor": str,
    "gr_before_invoice": bool, "invoice_before_creation": bool,
    "corrections_before_invoice": (int, float), "invoice_value": (int, float),
}
OPS = {"eq", "ne", "in", "ge", "le"}
MAX_RULES = 400
MIN_VENDOR = 50
MIN_VALUE = 50

SYSTEM = """You are designing an invoice triage policy for a purchase-to-pay process, from historical statistics only.

The policy decides, for each arriving invoice, whether it goes straight through to payment with no person checking it. Anything the policy doesn't pass is left to a person, which is always safe.

A wrongly passed invoice is one that needed a correction afterwards (a price or quantity change, cancellation, debit memo, payment block or deletion before payment). The policy will be judged on later months you have not seen. Its straight-through calls must be right at least 99 times in 100, measured as the 95% lower bound, and among policies that meet that bar, the one that passes more invoices is better. Small groups are risky: a group's rate in the earlier months can be luck.

Write the policy in this JSON rule language and nothing else:
{"rules": [{"if": [{"field": "<field>", "op": "eq|ne|in|ge|le", "value": <value>}], "why": "<short reason>"}], "default": "leave_to_person"}
An invoice passes when all conditions of at least one rule hold. "in" takes a list. "ge" and "le" take numbers.
Fields: case_type, category, spend_area, sub_spend_area, doc_type, item_type, company, vendor (strings); gr_before_invoice, invoice_before_creation (true/false); corrections_before_invoice, invoice_value (numbers).
At most 400 rules. Answer with the JSON only."""


def _row(k, n):
    lo, _ = wilson(k, n)
    return {"straight_through": k, "total": n, "rate": round(k / n, 4), "lower_95": round(lo, 4)}


def aggregates(fit_records):
    cells = defaultdict(lambda: [0, 0])
    vendors = defaultdict(lambda: [0, 0])
    single = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    vend_cell = defaultdict(lambda: [0, 0])
    for r in fit_records:
        st = 1 if r["straight_through"] else 0
        c = cell(r)
        for table, key in ((cells, c), (vendors, r["vendor"]), (vend_cell, (r["vendor"],) + c)):
            table[key][0] += st
            table[key][1] += 1
        for f in ("category", "spend_area", "sub_spend_area", "doc_type", "item_type", "company"):
            single[f][r.get(f)][0] += st
            single[f][r.get(f)][1] += 1
    total = len(fit_records)
    k_all = sum(1 for r in fit_records if r["straight_through"])
    return {
        "months": "January to May 2018",
        "overall": _row(k_all, total),
        "by_cell": [dict(case_type=c[0], corrections_before_invoice_any=c[1], gr_before_invoice=c[2], **_row(k, n))
                    for c, (k, n) in sorted(cells.items())],
        "by_vendor": [dict(vendor=v, **_row(k, n)) for v, (k, n) in sorted(vendors.items()) if n >= MIN_VENDOR],
        "by_vendor_and_cell": [dict(vendor=k_[0], case_type=k_[1], corrections_before_invoice_any=k_[2],
                                    gr_before_invoice=k_[3], **_row(k, n))
                               for k_, (k, n) in sorted(vend_cell.items()) if n >= MIN_VENDOR],
        "by_field": {f: [dict(value=v, **_row(k, n)) for v, (k, n) in sorted(t.items(), key=lambda x: str(x[0]))
                         if n >= MIN_VALUE] for f, t in single.items()},
    }


def prompt(agg):
    return "Statistics from the earlier months:\n" + json.dumps(agg)


def validate(policy):
    """Return a list of problems; empty means the policy can run."""
    errs = []
    if not isinstance(policy, dict):
        return ["policy is not an object"]
    if policy.get("default", "leave_to_person") != "leave_to_person":
        errs.append("default must be leave_to_person")
    rules = policy.get("rules")
    if not isinstance(rules, list) or not rules:
        return errs + ["rules must be a non-empty list"]
    if len(rules) > MAX_RULES:
        errs.append(f"more than {MAX_RULES} rules")
    for i, rule in enumerate(rules):
        conds = rule.get("if") if isinstance(rule, dict) else None
        if not isinstance(conds, list) or not conds:
            errs.append(f"rule {i}: 'if' must be a non-empty list")
            continue
        for c in conds:
            if not isinstance(c, dict):
                errs.append(f"rule {i}: condition is not an object")
                continue
            f, op, v = c.get("field"), c.get("op"), c.get("value")
            if f not in FIELDS:
                errs.append(f"rule {i}: unknown field {f!r}")
                continue
            if op not in OPS:
                errs.append(f"rule {i}: unknown op {op!r}")
                continue
            want = FIELDS[f]
            if op == "in":
                if not isinstance(v, list) or not v or not all(_typed(x, want) for x in v):
                    errs.append(f"rule {i}: 'in' needs a non-empty list of the field's type")
            elif op in ("ge", "le"):
                if want != (int, float) or not _typed(v, want):
                    errs.append(f"rule {i}: {op} needs a numeric field and value")
            elif not _typed(v, want):
                errs.append(f"rule {i}: value type does not match field {f}")
    return errs


def _typed(v, want):
    if want is bool:
        return isinstance(v, bool)
    if isinstance(v, bool):
        return False
    return isinstance(v, want)


def _value(r, f):
    return case_type(r) if f == "case_type" else r.get(f)


def _holds(r, c):
    x, op, v = _value(r, c["field"]), c["op"], c["value"]
    if op == "eq":
        return x == v
    if op == "ne":
        return x != v
    if op == "in":
        return x in v
    if x is None:
        return False
    return x >= v if op == "ge" else x <= v


def decider(policy):
    rules = [r["if"] for r in policy["rules"]]
    return lambda rec: any(all(_holds(rec, c) for c in conds) for conds in rules)


def choose(policies, fit_records):
    """Pick the valid policy with the highest earlier-month coverage whose pooled
    lower bound is at least the bar. Returns (index or None, per-policy summary)."""
    summary = []
    best, best_cov = None, -1.0
    for i, p in enumerate(policies):
        errs = validate(p) if p is not None else ["no policy in reply"]
        if errs:
            summary.append({"policy": i, "valid": False, "errors": errs[:20]})
            continue
        res = evaluate(fit_records, decider(p))["pooled"]
        ok = res["precision_lower"] is not None and res["precision_lower"] >= BAR
        summary.append({"policy": i, "valid": True, "rules": len(p["rules"]), "fit_coverage": res["coverage"],
                        "fit_precision": res["precision"], "fit_lower": res["precision_lower"], "meets_bar_on_fit": ok})
        cov = res["calls"] / res["invoices"] if res["invoices"] else 0
        if ok and cov > best_cov:
            best, best_cov = i, cov
    return best, summary


def stub_policy(_prompt_text):
    return {"rules": [{"if": [{"field": "corrections_before_invoice", "op": "le", "value": 0},
                              {"field": "gr_before_invoice", "op": "eq", "value": True},
                              {"field": "case_type", "op": "eq",
                               "value": "3-way match, invoice before GR / Trading & End Products"}],
                       "why": "stub"}], "default": "leave_to_person"}
