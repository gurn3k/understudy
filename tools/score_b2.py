"""Score the follow-up run of contender B (ADR 0018). Only the analyses in ADR 0018 items 5-7.

Usage:
  python tools/score_b2.py reproduce     # must give 88 passed, 1 wrong, 93.8% on the first sample
  python tools/score_b2.py final         # once the run has ended or stopped; writes b2_result.json
"""
import json
import os
import sys
from collections import Counter
from math import comb
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_c as C  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.evaluate import case_type, wilson  # noqa: E402
from understudy.files import load_json, save_json, verify  # noqa: E402

DATA = Path(os.environ.get("UNDERSTUDY_DATA", Path(os.environ.get("LOCALAPPDATA", ".")) / "understudy" / "data"))
BAR, A_COVERAGE_MARGIN, MIN_BLOCKS, CHOSEN_POLICY = 0.99, 0.10, 7, 2


def sign_p(k, n):
    """One-sided exact sign test: P(X >= k) for X ~ Bin(n, 0.5)."""
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n if n else 1.0


def b_alone(records, b_dec):
    passed = [r for r in records if b_dec[r["id"]]]
    wrong = sum(1 for r in passed if not r["straight_through"])
    lo, hi = wilson(len(passed) - wrong, len(passed)) if passed else (None, None)
    outcome = ("proved" if lo is not None and lo >= BAR else
               "below_bar" if hi is not None and hi < BAR else "not_proved")
    return {"n": len(records), "passed": len(passed), "wrong": wrong, "coverage": len(passed) / len(records),
            "lower": lo, "upper": hi, "outcome": outcome}


def b_vs_c(records, b_dec, c_decide):
    b_err = {r["id"] for r in records if b_dec[r["id"]] and not r["straight_through"]}
    c_err = {r["id"] for r in records if c_decide(r) and not r["straight_through"]}
    bp, cp = sum(1 for r in records if b_dec[r["id"]]), sum(1 for r in records if c_decide(r))
    only_b, only_c = len(b_err - c_err), len(c_err - b_err)
    p_b, p_c = sign_p(only_c, only_b + only_c), sign_p(only_b, only_b + only_c)
    winner = "B" if bp >= cp and p_b <= 0.05 else "C" if cp >= bp and p_c <= 0.05 else "not_separated"
    return {"B_passed": bp, "C_passed": cp, "B_wrong": len(b_err), "C_wrong": len(c_err),
            "B_only": only_b, "C_only": only_c, "p_B_better": p_b, "p_C_better": p_c, "winner": winner}


def b_vs_a(alone):
    """A passes nothing, so B beats A only with coverage >= 10% and a lower bound >= 99%."""
    return alone["coverage"] >= A_COVERAGE_MARGIN and alone["outcome"] == "proved"


def per_type(records, b_dec):
    """Descriptive only: no claim is made from it (ADR 0018 item 8)."""
    p, w = Counter(), Counter()
    for r in records:
        if b_dec[r["id"]]:
            p[case_type(r)] += 1
            w[case_type(r)] += not r["straight_through"]
    return {t: {"passed": p[t], "wrong": w[t]} for t in sorted(p)}


def reproduce():
    verify(DATA / "sample.jsonl", "sample.sha256")
    sample = list(iter_jsonl(DATA / "sample.jsonl"))
    res = b_alone(sample, load_json(DATA / "b_live_1500.json")["decisions"])
    got = (res["passed"], res["wrong"], round(res["lower"] * 100, 1))
    print(json.dumps({"first_sample": res, "matches": got == (88, 1, 93.8)}, indent=1))
    return got == (88, 1, 93.8)


def final():
    verify(DATA / "invoice_triage_heldout.jsonl", "heldout.sha256")
    verify(DATA / "sample2.jsonl", "sample2.sha256")
    recs = list(iter_jsonl(DATA / "sample2.jsonl"))
    dec, blocks = {}, 0
    while (DATA / f"b2_live_block_{blocks + 1:02d}.json").exists():
        blocks += 1
        dec.update(load_json(DATA / f"b2_live_block_{blocks:02d}.json")["decisions"])
    done = recs[:blocks * 1000]
    if blocks < MIN_BLOCKS:
        out = {"blocks": blocks, "outcome": "too_small_to_decide"}
    else:
        decide = C.decider(load_json(DATA / "responses" / "c" / f"c_policy_{CHOSEN_POLICY}.json")["reply"])
        alone = b_alone(done, dec)
        out = {"blocks": blocks, "b_alone": alone, "b_vs_c": b_vs_c(done, dec, decide),
               "b_beats_a": b_vs_a(alone), "per_type_descriptive": per_type(done, dec)}
    save_json(out, DATA / "b2_result.json", indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    if sys.argv[1:] == ["reproduce"]:
        sys.exit(0 if reproduce() else 1)
    elif sys.argv[1:] == ["final"]:
        final()
    else:
        sys.exit(__doc__)
