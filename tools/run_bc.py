"""Run contender B or C in stub, replay or live mode.

Usage:
  python tools/run_bc.py b <mode> <limit> <max_live_calls>
  python tools/run_bc.py c <mode> <n_policies> <max_live_calls>
Responses are saved under %LOCALAPPDATA%/understudy/data/responses/<b|c>/.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_b as B, contender_c as C  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.claude_call import CallCap, Caller, StopRun  # noqa: E402
from understudy.evaluate import evaluate  # noqa: E402
from understudy.files import verify  # noqa: E402

DATA = Path(os.environ["LOCALAPPDATA"]) / "understudy" / "data"
SCRATCH = DATA / "claude_cwd"   # empty folder, so the CLI picks up no project files
SCRATCH.mkdir(parents=True, exist_ok=True)


def main():
    which, mode, n, cap = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    verify(DATA / "invoice_triage_heldout.jsonl", "heldout.sha256")
    verify(DATA / "sample.jsonl", "sample.sha256")
    fit = list(iter_jsonl(DATA / "invoice_triage_fit.jsonl"))
    sample = list(iter_jsonl(DATA / "sample.jsonl"))
    out = {"which": which, "mode": mode}
    try:
        if which == "b":
            recs = sorted(sample, key=lambda r: r["id"])[:n]
            caller = Caller(mode, DATA / "responses" / "b", B.SYSTEM, stub_fn=B.stub_reply,
                            max_live_calls=cap, workdir=str(SCRATCH))
            dec, log = B.run(recs, B.context(fit), caller)
            res = evaluate(recs, lambda r: dec[r["id"]])
            out.update(n=len(recs), pooled={k: res["pooled"][k] for k in
                       ("precision", "coverage", "precision_lower", "coverage_at_bar")},
                       issues=sum(len(row["issues"]) for row in log), calls=len(log),
                       meta=[row["meta"] for row in log])
            (DATA / f"b_{mode}_{len(recs)}.json").write_text(json.dumps({"decisions": dec, "log": log, "result": res}))
        else:
            agg = C.aggregates(fit)
            caller = Caller(mode, DATA / "responses" / "c", C.SYSTEM, stub_fn=C.stub_policy,
                            max_live_calls=cap, workdir=str(SCRATCH))
            recs = [caller.ask(f"c_policy_{i + 1}", C.prompt(agg)) for i in range(n)]
            policies = [r["reply"] for r in recs]
            idx, summary = C.choose(policies, fit)
            out.update(policies=summary, chosen=idx, meta=[r.get("meta", {}) for r in recs])
            if idx is not None:
                d = C.decider(policies[idx])
                held = list(iter_jsonl(DATA / "invoice_triage_heldout.jsonl"))
                full, samp = evaluate(held, d), evaluate(sample, d)
                out.update(full={k: full["pooled"][k] for k in ("precision", "coverage", "precision_lower", "coverage_at_bar")},
                           sample={k: samp["pooled"][k] for k in ("precision", "coverage", "precision_lower", "coverage_at_bar")})
                (DATA / f"c_{mode}_{n}.json").write_text(json.dumps({"summary": summary, "chosen": idx,
                                                                      "full": full, "sample": samp}))
    except (StopRun, CallCap) as e:
        out["stopped"] = str(e)
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
