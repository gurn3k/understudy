"""Measure how many earlier-month outcomes landed after the first held-out invoice arrived.

Usage: python tools/lookahead.py <data_dir>   -> writes <data_dir>/lookahead.json
Earlier months are split by order-line creation month, so some of their outcomes
were not yet known when held-out invoices began to arrive. Reads only; calls no model.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.files import save_json  # noqa: E402
from understudy.triage import timing, triage_record  # noqa: E402

data = Path(sys.argv[1])
first_day = min(t["invoice_ts"] for t in iter_jsonl(data / "heldout_timing.jsonl"))[:10]
fit_n = late = 0
for c in iter_jsonl(data / "cases.jsonl"):
    rec, _ = triage_record(c)
    if rec is None or rec["split"] != "fit":
        continue
    fit_n += 1
    if timing(c)["clear_ts"][:10] >= first_day:
        late += 1
save_json({"first_heldout_day": first_day, "fit_outcomes": fit_n, "landed_on_or_after": late}, data / "lookahead.json")
print(first_day, fit_n, late)
