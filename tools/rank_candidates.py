"""Rank the three decision points on the full log and lock the winner's held-out set.

Usage: python tools/rank_candidates.py <data_dir>
Writes candidates.json, <winner>_fit.jsonl, <winner>_heldout.jsonl and
prints the held-out SHA-256 (recorded in docs/heldout.sha256).
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.candidates import rank  # noqa: E402
from understudy.triage import CASE_FIELDS, creation_record, triage_record  # noqa: E402

data = Path(sys.argv[1])
analysis = json.load(open(data / "analysis.json", encoding="utf-8"))
tri, price, qty = [], [], []
unlab = {}
for c in iter_jsonl(data / "cases.jsonl"):
    r, why = triage_record(c)
    if r:
        tri.append(r)
    else:
        unlab[why] = unlab.get(why, 0) + 1
    for act, bucket in (("Change Price", price), ("Change Quantity", qty)):
        r2, _ = creation_record(c, act)
        if r2:
            bucket.append(r2)

tri_fields = list(CASE_FIELDS) + ["gr_before_invoice", "corrections_before_invoice", "invoice_before_creation"]
cands = [
    {"name": "invoice_triage", "volume_activities": ["Clear Invoice", "Remove Payment Block"],
     "records": tri, "fields": tri_fields, "label": "straight_through"},
    {"name": "price_change_risk", "volume_activities": ["Change Price"],
     "records": price, "fields": list(CASE_FIELDS), "label": "positive"},
    {"name": "quantity_change_risk", "volume_activities": ["Change Quantity"],
     "records": qty, "fields": list(CASE_FIELDS), "label": "positive"},
]
ranked = rank(cands, analysis)
for c in cands:
    for r in ranked:
        if r["name"] == c["name"]:
            recs = c["records"]
            r["records"] = {s: sum(1 for x in recs if x["split"] == s) for s in ("fit", "heldout")}
            r["positive_rate"] = {s: round(sum(1 for x in recs if x["split"] == s and x[c["label"]]) /
                                           max(1, r["records"][s]), 4) for s in ("fit", "heldout")}
out = {"ranked": ranked, "triage_unlabelled": unlab}
json.dump(out, open(data / "candidates.json", "w", encoding="utf-8"), indent=1)

win = next(c for c in cands if c["name"] == ranked[0]["name"])
for split in ("fit", "heldout"):
    with open(data / f"{win['name']}_{split}.jsonl", "w", encoding="utf-8", newline="\n") as f:
        for r in sorted((x for x in win["records"] if x["split"] == split), key=lambda x: x["id"]):
            f.write(json.dumps(r, sort_keys=True) + "\n")
h = hashlib.sha256((data / f"{win['name']}_heldout.jsonl").read_bytes()).hexdigest()
print(json.dumps(out, indent=1))
print("winner", win["name"], "heldout_sha256", h)
