"""Agreement-gate sweep: how the simulated agreement gate fares as the reviewer's catch rate and false-flag rate
change, at each copy rate. Local compute only (no model calls). Writes agreement_sweep.json to the data folder;
tools/build_site.py reads it.

Usage: python tools/run_sweep.py <data_dir> [runs per cell, default 10]
"""
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_c as C  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.files import load_json, save_json, verify  # noqa: E402
from understudy.replay import replay, reviewer  # noqa: E402

ALPHAS = (0.5, 0.7, 0.9)
CATCH = (0.5, 0.8, 0.95)       # share of real exceptions a reviewer who is not copying catches
FALSE_FLAG = (0.02, 0.1)       # share of clean invoices a reviewer who is not copying wrongly flags


def main(data, runs):
    held_path = data / "invoice_triage_heldout.jsonl"
    verify(held_path, "heldout.sha256")
    held = list(iter_jsonl(held_path))
    tm = {t["id"]: t for t in iter_jsonl(data / "heldout_timing.jsonl")}
    chosen = load_json(data / "c_live_3.json")["chosen"]
    decide = C.decider(load_json(data / "responses" / "c" / f"c_policy_{chosen + 1}.json")["reply"])
    cells = []
    for a in ALPHAS:
        for c in CATCH:
            for f in FALSE_FLAG:
                reps = [replay(held, tm, decide, gate="agreement", agree=reviewer(a, catch=c, false_flag=f, seed=20261115 + i))["totals"]
                        for i in range(runs)]
                cells.append({"alpha": a, "catch": c, "false_flag": f, "runs": runs,
                              "passed_median": statistics.median(r["passed"] for r in reps),
                              "wrong_median": statistics.median(r["wrong"] for r in reps),
                              "rate_median": statistics.median(r["wrong"] / r["passed"] if r["passed"] else 0 for r in reps)})
                print(cells[-1], flush=True)
    save_json({"cells": cells, "alphas": ALPHAS, "catch": CATCH, "false_flag": FALSE_FLAG}, data / "agreement_sweep.json")


if __name__ == "__main__":
    main(Path(sys.argv[1]), int(sys.argv[2]) if len(sys.argv) > 2 else 10)
