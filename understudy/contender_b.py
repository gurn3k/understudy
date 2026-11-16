"""Contender B: Claude judges each invoice from facts known at the decision point.

Code computes every fact (including earlier-month rates); the model judges.
Its answers pass a code gate before they count: anything invalid or missing
becomes "leave to a person" and is logged.
"""
import hashlib
import json
from collections import defaultdict

from understudy.contenders import cell
from understudy.evaluate import case_type, wilson

BATCH = 25
DECISIONS = {"straight_through", "leave_to_person"}

SYSTEM = """You are triaging supplier invoices in a purchase-to-pay process.
For each invoice, decide whether it can go straight through to payment with no person checking it, or must be left to a person.

What "straight through" means: the invoice is paid with no correction afterwards. A correction is any price or quantity change, cancellation, debit memo, payment block or deletion before payment.

The bar: a wrongly passed invoice is a payment that needed correcting. Your straight-through calls must be right at least 99 times in 100. Leaving an invoice to a person is always safe; it only costs a person's time. When in doubt, leave it to a person.

You get facts known at the moment the invoice arrives, plus rates from earlier months:
- cell_history: invoices in the earlier months with the same case type, the same corrections-before-invoice status and the same goods-receipt status. It gives straight-through count, total, rate and the 95% lower bound of the rate.
- vendor_history: the same for this vendor in the earlier months, or null when the vendor had fewer than 20 invoices then.

Answer with JSON only, exactly this shape, one entry per invoice id given, in any order:
{"decisions": [{"id": "<id>", "decision": "straight_through" | "leave_to_person", "reason": "<under 20 words>"}]}"""


def context(fit_records):
    cells = defaultdict(lambda: [0, 0])
    vendors = defaultdict(lambda: [0, 0])
    for r in fit_records:
        for table, key in ((cells, cell(r)), (vendors, r["vendor"])):
            table[key][1] += 1
            if r["straight_through"]:
                table[key][0] += 1
    return {"cells": dict(cells), "vendors": dict(vendors)}


def _hist(kn, min_n=1):
    if not kn or kn[1] < min_n:
        return None
    k, n = kn
    lo, _ = wilson(k, n)
    return {"straight_through": k, "total": n, "rate": round(k / n, 4), "lower_95": round(lo, 4)}


def facts(r, ctx):
    return {
        "id": r["id"],
        "case_type": case_type(r),
        "document_type": r.get("doc_type"),
        "sub_spend_area": r.get("sub_spend_area"),
        "item_type": r.get("item_type"),
        "company": r.get("company"),
        "vendor": r.get("vendor"),
        "invoice_value_eur": r.get("invoice_value"),
        "goods_received_before_invoice": r["gr_before_invoice"],
        "corrections_before_invoice": r["corrections_before_invoice"],
        "invoice_dated_before_order": r["invoice_before_creation"],
        "cell_history": _hist(ctx["cells"].get(cell(r))),
        "vendor_history": _hist(ctx["vendors"].get(r["vendor"]), min_n=20),
    }


def batches(records):
    rs = sorted(records, key=lambda r: r["id"])
    for i in range(0, len(rs), BATCH):
        chunk = rs[i:i + BATCH]
        ids = [r["id"] for r in chunk]
        tag = hashlib.sha256("|".join(ids).encode()).hexdigest()[:8]
        yield f"b_{i // BATCH:03d}_{tag}", chunk


def prompt(chunk, ctx):
    return "Invoices:\n" + json.dumps([facts(r, ctx) for r in chunk], indent=1)


def gate(ids, reply):
    """Return ({id: True if straight through}, [issues]). Fails closed."""
    issues = []
    out = {i: False for i in ids}
    if not isinstance(reply, dict) or not isinstance(reply.get("decisions"), list):
        return out, ["no decisions list"]
    seen = set()
    for d in reply["decisions"]:
        if not isinstance(d, dict):
            issues.append("non-object entry")
            continue
        i, dec = d.get("id"), d.get("decision")
        if not isinstance(i, str) or not isinstance(dec, str):
            issues.append("id or decision is not a string")
            continue
        if i not in out:
            issues.append(f"unknown id {i!r}")
            continue
        if i in seen:
            issues.append(f"duplicate id {i}")
            out[i] = False
            continue
        seen.add(i)
        if dec not in DECISIONS:
            issues.append(f"bad decision for {i}: {dec!r}")
            continue
        out[i] = dec == "straight_through"
    for i in ids:
        if i not in seen:
            issues.append(f"missing {i}")
    return out, issues


def stub_reply(prompt_text):
    """Free deterministic stand-in: pass when the cell's lower bound is high."""
    items = json.loads(prompt_text.split("\n", 1)[1])
    return {"decisions": [{"id": f["id"],
                           "decision": "straight_through" if (f["cell_history"] or {}).get("lower_95", 0) >= 0.98
                           else "leave_to_person", "reason": "stub"} for f in items]}


def run(records, ctx, caller):
    """Judge every record. Returns ({id: bool}, log rows)."""
    decisions, log = {}, []
    for key, chunk in batches(records):
        rec = caller.ask(key, prompt(chunk, ctx))
        ids = [r["id"] for r in chunk]
        got, issues = gate(ids, rec["reply"])
        decisions.update(got)
        log.append({"key": key, "n": len(ids), "issues": issues, "meta": rec.get("meta", {})})
    return decisions, log
