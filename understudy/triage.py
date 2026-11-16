"""Decision-point records: invoice triage, price-change risk, quantity-change risk.

Only facts known at the decision point go into a record. Labels come from
what happened afterwards in the log (docs/adr/0009-triage-target.md).
"""
from collections import defaultdict

CREATE = "Create Purchase Order Item"
IR = "Record Invoice Receipt"
CLR = "Clear Invoice"
GR = "Record Goods Receipt"

FIT_MONTHS = {f"2018-{m:02d}" for m in range(1, 6)}
HELDOUT_MONTHS = {"2018-06", "2018-07", "2018-08"}

CORRECTIVE_EXACT = {
    "Vendor creates debit memo", "Set Payment Block", "Block Purchase Order Item",
    "Delete Purchase Order Item", "Reactivate Purchase Order Item",
}

CASE_FIELDS = ("category", "doc_type", "spend_area", "sub_spend_area", "vendor",
               "company", "item_type", "gr_flag", "gr_based_iv")


def is_corrective(activity):
    return (activity.startswith("Change ") or activity.startswith("Cancel ")
            or activity in CORRECTIVE_EXACT)


def split_of(create_ts):
    month = create_ts[:7]
    if month in FIT_MONTHS:
        return "fit"
    if month in HELDOUT_MONTHS:
        return "heldout"
    return None


def triage_record(case):
    """Return (record, None) or (None, reason)."""
    evs = case["events"]
    created = min(e["ts"] for e in evs if e["act"] == CREATE)
    split = split_of(created)
    if split is None:
        return None, "outside_months"
    first_ir = next((i for i, e in enumerate(evs) if e["act"] == IR), None)
    if first_ir is None:
        return None, "no_invoice"
    clear = next((i for i in range(first_ir + 1, len(evs)) if evs[i]["act"] == CLR), None)
    if clear is None:
        return None, "not_finished"
    inv = evs[first_ir]
    before = evs[:first_ir]
    rec = {f: case.get(f) for f in CASE_FIELDS}
    rec.update({
        "id": case["id"],
        "split": split,
        "invoice_value": inv["worth"],
        "gr_before_invoice": any(e["act"] == GR for e in before),
        "corrections_before_invoice": sum(1 for e in before if is_corrective(e["act"])),
        "invoice_before_creation": inv["ts"] < created,
        "straight_through": not any(is_corrective(e["act"]) for e in evs[first_ir + 1:clear]),
    })
    return rec, None


def creation_record(case, activity):
    """Risk at creation: will this item later need `activity` (e.g. Change Price)?"""
    evs = case["events"]
    created = min(e["ts"] for e in evs if e["act"] == CREATE)
    split = split_of(created)
    if split is None:
        return None, "outside_months"
    rec = {f: case.get(f) for f in CASE_FIELDS}
    rec.update({"id": case["id"], "split": split,
                "positive": any(e["act"] == activity for e in evs)})
    return rec, None


def build_triage(cases):
    records, unlabelled = [], defaultdict(list)
    for c in cases:
        rec, why = triage_record(c)
        if rec is None:
            unlabelled[why].append(c["id"])
        else:
            records.append(rec)
    return records, {k: sorted(v) for k, v in unlabelled.items()}


def fit_rates(records, field, label="straight_through"):
    """[positives, total] per value of `field`, from the fitting months only."""
    rates = defaultdict(lambda: [0, 0])
    for r in records:
        if r["split"] != "fit":
            continue
        rates[r[field]][1] += 1
        if r[label]:
            rates[r[field]][0] += 1
    return {k: v for k, v in rates.items()}


def timing(case):
    """Replay timing for a labelled triage case: when the invoice arrived, when
    it cleared, and how many manual Clear Invoice / Remove Payment Block events
    the case had. Not given to any contender."""
    evs = case["events"]
    first_ir = next(i for i, e in enumerate(evs) if e["act"] == IR)
    clear = next(i for i in range(first_ir + 1, len(evs)) if evs[i]["act"] == CLR)
    touches = sum(1 for e in evs if e["act"] in (CLR, "Remove Payment Block") and e["kind"] == "manual")
    return {"id": case["id"], "invoice_ts": evs[first_ir]["ts"], "clear_ts": evs[clear]["ts"],
            "manual_touches": touches}
