"""Build replay timing, then replay A and C under the outcome gate and the
agreement-gate simulation.

Usage: python tools/run_replay.py <data_dir>
Needs c_live_3.json (C's chosen policy) and the saved C responses.
"""
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_c as C  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.contenders import fit_rule_a, rule_a  # noqa: E402
from understudy.files import load_json, save_json, verify  # noqa: E402
from understudy.replay import replay, reviewer  # noqa: E402
from understudy.triage import timing, triage_record  # noqa: E402

data = Path(sys.argv[1])
held_path = data / "invoice_triage_heldout.jsonl"
verify(held_path, "heldout.sha256")
held = list(iter_jsonl(held_path))
ids = {r["id"] for r in held}

tpath = data / "heldout_timing.jsonl"
if not tpath.exists():
    with open(tpath, "w", encoding="utf-8", newline="\n") as f:
        for c in iter_jsonl(data / "cases.jsonl"):
            if c["id"] in ids:
                rec, _ = triage_record(c)
                if rec is not None:
                    f.write(json.dumps(timing(c), sort_keys=True) + "\n")
tm = {t["id"]: t for t in iter_jsonl(tpath)}
missing = ids - set(tm)
if missing:
    sys.exit(f"{len(missing)} held-out invoices have no timing")

fit = list(iter_jsonl(data / "invoice_triage_fit.jsonl"))
passing, _ = fit_rule_a(fit)
c_run = load_json(data / "c_live_3.json")
chosen = c_run["chosen"]
policy = load_json(data / "responses" / "c" / f"c_policy_{chosen + 1}.json")["reply"]
contenders = {"A": rule_a(passing), "C": C.decider(policy)}

out = {"chosen_policy": chosen + 1, "outcome": {}, "agreement": {}}
for name, d in contenders.items():
    out["outcome"][name] = replay(held, tm, d)
for alpha in (0.5, 0.7, 0.9):
    reps = []
    for i in range(20):
        agr = replay(held, tm, contenders["C"], gate="agreement", agree=reviewer(alpha, seed=20261115 + i))
        reps.append({"first_promotion": agr["first_promotion"], "wrong": agr["totals"]["wrong"],
                     "passed": agr["totals"]["passed"], "promoted_types": len(agr["promoted_types"]),
                     "demotions": sum(1 for e in agr["events"] if e["event"] == "demoted")})
        if i == 0:
            out["agreement"][f"{alpha}_example"] = agr
    wrongs = [r["wrong"] for r in reps]
    out["agreement"][str(alpha)] = {"reps": reps, "wrong_median": statistics.median(wrongs),
                                     "wrong_range": [min(wrongs), max(wrongs)]}
save_json(out, data / "replay.json")
for name, r in out["outcome"].items():
    print(name, "outcome gate", r["totals"], "first", r["first_promotion"], "types", len(r["promoted_types"]),
          "demotions", sum(1 for e in r["events"] if e["event"] == "demoted"))
for alpha in ("0.5", "0.7", "0.9"):
    a = out["agreement"][alpha]
    firsts = sorted(x["first_promotion"] or "-" for x in a["reps"])
    print("agreement", alpha, "wrong median", a["wrong_median"], "range", a["wrong_range"], "first", firsts[0], firsts[-1],
          "passed median", statistics.median(x["passed"] for x in a["reps"]))
