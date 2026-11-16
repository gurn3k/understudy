"""Score every C policy on all held-out invoices, and compare B with the chosen
C policy on the shared sample (ADR 0015, Amendment 1). Writes compare.json."""
import json
import os
import sys
from math import comb
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_c as C  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.contenders import fit_rule_a, rule_a  # noqa: E402
from understudy.evaluate import evaluate  # noqa: E402

DATA = Path(os.environ["LOCALAPPDATA"]) / "understudy" / "data"
KEYS = ("precision", "coverage", "precision_lower", "coverage_at_bar")


def sign_p(k, n):
    """One-sided exact sign test: P(X >= k) for X ~ Bin(n, 0.5)."""
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n if n else 1.0


held = list(iter_jsonl(DATA / "invoice_triage_heldout.jsonl"))
sample = list(iter_jsonl(DATA / "sample.jsonl"))
fit = list(iter_jsonl(DATA / "invoice_triage_fit.jsonl"))
crun = json.load(open(DATA / "c_live_3.json", encoding="utf-8"))
policies = [json.load(open(DATA / "responses" / "c" / f"c_policy_{i}.json", encoding="utf-8"))["reply"] for i in (1, 2, 3)]
out = {"chosen_policy": crun["chosen"] + 1, "policies": []}
for i, pol in enumerate(policies, 1):
    res = evaluate(held, C.decider(pol))
    out["policies"].append({"policy": i, "rules": len(pol["rules"]), "held_out": {k: res["pooled"][k] for k in KEYS},
                            "seen_when_rule_written": i == 1})
passing, _ = fit_rule_a(fit)
a = evaluate(held, rule_a(passing))
out["A_held_out"] = {k: a["pooled"][k] for k in KEYS}
b = json.load(open(DATA / "b_live_1500.json", encoding="utf-8"))["decisions"]
dc = C.decider(policies[crun["chosen"]])
b_err = {r["id"] for r in sample if b[r["id"]] and not r["straight_through"]}
c_err = {r["id"] for r in sample if dc(r) and not r["straight_through"]}
only_b, only_c = len(b_err - c_err), len(c_err - b_err)
out["B_vs_C_sample"] = {"B_passed": sum(b.values()), "C_passed": sum(1 for r in sample if dc(r)),
                        "B_errors": len(b_err), "C_errors": len(c_err), "B_only_errors": only_b, "C_only_errors": only_c,
                        "p_B_better": sign_p(only_c, only_b + only_c), "p_C_better": sign_p(only_b, only_b + only_c)}
json.dump(out, open(DATA / "compare.json", "w", encoding="utf-8"), indent=1)
print(json.dumps(out, indent=1))
