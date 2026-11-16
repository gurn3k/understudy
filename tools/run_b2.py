"""Follow-up run of contender B on a second, larger held-out sample (ADR 0018).

Usage:
  python tools/run_b2.py draw                          # draw and lock the sample (once)
  python tools/run_b2.py run <mode> <first> <last> <max_live_calls>
                                                       # judge blocks first..last (1-based, 1,000 invoices each)
Run prints usage, time and gate failures only. No accuracy figure is computed here.
"""
import hashlib
import json
import os
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_b as B  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
import subprocess  # noqa: E402

from understudy.claude_call import MODEL, CallCap, Caller, StopRun  # noqa: E402
from understudy.files import DOCS, verify  # noqa: E402
from understudy.sample import stratified  # noqa: E402

DATA = Path(os.environ.get("UNDERSTUDY_DATA", Path(os.environ.get("LOCALAPPDATA", ".")) / "understudy" / "data"))
SAMPLE2 = DATA / "sample2.jsonl"
LOCK = "sample2.sha256"
SIZE, SEED, BLOCK = 10_000, 20261116, 1_000
# Must equal the first run's (ADR 0018 item 2): system prompt, model and earlier-month data.
FIRST_RUN = {"system_sha256": "dc42aed66ee817c77cc96315b4db25587abea8b208f2526ebf6d8e1581ba781e",
             "model": "claude-opus-5-5",
             "fit_sha256": "b0e565c2ad69580b010a62f5f4ed4beab75e25d2d64061e1885e106223927ea4"}
RETRIES = 2


def same_as_first_run():
    now = {"system_sha256": hashlib.sha256(B.SYSTEM.encode()).hexdigest(), "model": MODEL,
           "fit_sha256": hashlib.sha256((DATA / "invoice_triage_fit.jsonl").read_bytes()).hexdigest()}
    bad = [k for k in FIRST_RUN if now[k] != FIRST_RUN[k]]
    if bad:
        sys.exit(f"differs from the first run: {', '.join(bad)}; stopping before any call")


class Retrying:
    """Retry a call only when no response arrived, with the identical request, at most twice."""

    def __init__(self, caller):
        self.caller = caller

    def ask(self, key, prompt):
        for attempt in range(RETRIES + 1):
            try:
                return self.caller.ask(key, prompt)
            except (StopRun, subprocess.TimeoutExpired):
                if attempt == RETRIES:
                    raise


def draw():
    """Stratified draw of held-out invoices not in the first sample, stored in a seeded random order."""
    if SAMPLE2.exists() or (DOCS / LOCK).exists():
        sys.exit("sample2 already drawn; it is never redrawn")
    verify(DATA / "invoice_triage_heldout.jsonl", "heldout.sha256")
    verify(DATA / "sample.jsonl", "sample.sha256")
    first = {r["id"] for r in iter_jsonl(DATA / "sample.jsonl")}
    pool = [r for r in iter_jsonl(DATA / "invoice_triage_heldout.jsonl") if r["id"] not in first]
    picked = stratified(pool, SIZE, SEED)
    assert not {r["id"] for r in picked} & first, "overlap with the first sample"
    random.Random(SEED).shuffle(picked)
    with open(SAMPLE2, "w", encoding="utf-8", newline="\n") as f:
        for r in picked:
            f.write(json.dumps(r, sort_keys=True) + "\n")
    sha = hashlib.sha256(SAMPLE2.read_bytes()).hexdigest()
    (DOCS / LOCK).write_text(f"{sha}  sample2.jsonl\n")
    print(json.dumps({"drawn": len(picked), "pool": len(pool), "overlap_with_first": len({r['id'] for r in picked} & first),
                      "sha256": sha}))


def run(mode, first, last, cap):
    verify(DATA / "invoice_triage_heldout.jsonl", "heldout.sha256")
    verify(SAMPLE2, LOCK)
    same_as_first_run()
    recs = list(iter_jsonl(SAMPLE2))
    ctx = B.context(list(iter_jsonl(DATA / "invoice_triage_fit.jsonl")))
    caller = Caller(mode, DATA / "responses" / "b2", B.SYSTEM, stub_fn=B.stub_reply,
                    max_live_calls=cap, workdir=str(DATA / "claude_cwd"))
    (DATA / "claude_cwd").mkdir(parents=True, exist_ok=True)
    report = []
    for b in range(first, last + 1):
        chunk = recs[(b - 1) * BLOCK: b * BLOCK]
        if not chunk:
            break
        t0 = time.perf_counter()
        try:
            dec, log = B.run(chunk, ctx, Retrying(caller))
        except (StopRun, CallCap) as e:
            report.append({"block": b, "stopped": str(e)})
            break
        out = DATA / f"b2_{mode}_block_{b:02d}.json"
        out.write_text(json.dumps({"block": b, "decisions": dec, "log": log}))
        meta = [row["meta"] for row in log]
        report.append({"block": b, "n": len(chunk), "calls": len(log),
                       "gate_issues": sum(len(row["issues"]) for row in log),
                       "usd": round(sum(m.get("api_equivalent", {}).get("usd", 0) for m in meta), 4),
                       "input_tokens": sum(m.get("api_equivalent", {}).get("input_tokens", 0) for m in meta),
                       "output_tokens": sum(m.get("api_equivalent", {}).get("output_tokens", 0) for m in meta),
                       "wall_s": round(time.perf_counter() - t0, 1)})
        print(json.dumps(report[-1]), flush=True)
    print(json.dumps({"done": report}, indent=1))


if __name__ == "__main__":
    if sys.argv[1] == "draw":
        draw()
    elif sys.argv[1] == "run":
        run(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]))
    else:
        sys.exit(__doc__)
