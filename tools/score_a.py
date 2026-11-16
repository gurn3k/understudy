"""Score contender A and the pass-everything reference; lock the shared sample.

Usage: python tools/score_a.py <data_dir>
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.contenders import fit_rule_a, pass_everything, rule_a  # noqa: E402
from understudy.evaluate import evaluate  # noqa: E402
from understudy.sample import stratified  # noqa: E402

data = Path(sys.argv[1])
held_path = data / "invoice_triage_heldout.jsonl"
want = (ROOT / "docs" / "heldout.sha256").read_text().split()[0]
got = hashlib.sha256(held_path.read_bytes()).hexdigest()
if got != want:
    sys.exit(f"held-out file changed: {got} != {want}")
fit = list(iter_jsonl(data / "invoice_triage_fit.jsonl"))
held = list(iter_jsonl(held_path))
sample = stratified(held)
with open(data / "sample.jsonl", "w", encoding="utf-8", newline="\n") as f:
    for r in sample:
        f.write(json.dumps(r, sort_keys=True) + "\n")
sh = hashlib.sha256((data / "sample.jsonl").read_bytes()).hexdigest()
(ROOT / "docs" / "sample.sha256").write_text(f"{sh}  sample.jsonl\n")

passing, stats = fit_rule_a(fit)
a = rule_a(passing)
out = {
    "rule_a": {"passing_cells": sorted([list(c) for c in passing]),
               "full": evaluate(held, a), "sample": evaluate(sample, a)},
    "pass_everything": {"full": evaluate(held, pass_everything), "sample": evaluate(sample, pass_everything),
                        "fit": evaluate(fit, pass_everything)["pooled"]},
}
json.dump(out, open(data / "results_a.json", "w", encoding="utf-8"))
for name in ("rule_a", "pass_everything"):
    for part in ("full", "sample"):
        p = out[name][part]["pooled"]
        ready = sum(1 for t in out[name][part]["types"].values() if t["verdict"] == "helper-ready")
        print(name, part, "precision", p["precision"], "lower", round(p["precision_lower"] or 0, 4),
              "coverage", p["coverage"], "at_bar", round(p["coverage_at_bar"], 4), "ready_types", ready)
print("passing cells", len(passing), "sample sha", sh)
