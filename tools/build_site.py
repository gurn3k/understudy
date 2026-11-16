"""Build site/data.json from the analysis outputs. Every figure on the page comes from here.

Usage: python tools/build_site.py
Reads %LOCALAPPDATA%/understudy/data; writes site/data.json.
"""
import json
import os
import re
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from understudy import contender_c as C  # noqa: E402
from understudy.analyse import iter_jsonl  # noqa: E402
from understudy.evaluate import Z, case_type, wilson  # noqa: E402
from understudy.files import load_json, save_json, verify  # noqa: E402
from understudy.replay import replay  # noqa: E402

DATA = Path(os.environ["LOCALAPPDATA"]) / "understudy" / "data"
OUT = ROOT / "site" / "data.json"
KEYS = ("precision", "coverage", "precision_lower")


def kn(res):
    return {k: res[k] for k in KEYS}


def min_calls(errors):
    n = errors + 1
    while wilson(n - errors, n)[0] < 0.99:
        n += 1
    return n


def adrs():
    rows = []
    for p in sorted((ROOT / "docs" / "adr").glob("0*.md")):
        text = p.read_text(encoding="utf-8")
        title = re.sub(r"^#\s*\d+\.\s*", "", text.splitlines()[0]).strip()
        amended = len(re.findall(r"^## Amendment", text, re.M))
        by = re.search(r"^Note: ADR (\d{4}) replaces this ADR's", text, re.M)
        rows.append({"n": p.name[:4], "title": title, "amendments": amended, "replaced_by": by.group(1) if by else None,
                     "file": f"docs/adr/{p.name}"})
    return rows


def main():
    verify(DATA / "invoice_triage_heldout.jsonl", "heldout.sha256")
    verify(DATA / "sample.jsonl", "sample.sha256")
    held = list(iter_jsonl(DATA / "invoice_triage_heldout.jsonl"))
    sample = list(iter_jsonl(DATA / "sample.jsonl"))
    by_id = {r["id"]: r for r in held}
    analysis, checks = load_json(DATA / "analysis.json"), load_json(DATA / "checks.json")
    cands, res_a = load_json(DATA / "candidates.json"), load_json(DATA / "results_a.json")
    compare, rep = load_json(DATA / "compare.json"), load_json(DATA / "replay.json")
    crun, brun = load_json(DATA / "c_live_3.json"), load_json(DATA / "b_live_1500.json")
    chosen = compare["chosen_policy"]
    policies = [load_json(DATA / "responses" / "c" / f"c_policy_{i}.json") for i in (1, 2, 3)]
    decide = C.decider(policies[chosen - 1]["reply"])

    acts = sorted(analysis["activities"].items(), key=lambda kv: -kv[1]["manual"])
    work = [{"activity": a, "manual": v["manual"], "batch": v["batch"], "unclassified": v["unclassified"],
             "events": v["events"]} for a, v in acts[:10]]

    # Contenders.
    fit_summary = {s["policy"] + 1: s for s in crun["summary"]}
    pols = []
    for p in compare["policies"]:
        f = fit_summary[p["policy"]]
        pols.append({**p, "chosen": p["policy"] == chosen, "fit_lower": f["fit_lower"],
                     "fit_coverage": f["fit_coverage"]})
    c_sample_pass = [r for r in sample if decide(r)]
    b_dec = brun["decisions"]
    b_meta = [row["meta"] for row in brun["log"]]
    c_meta = [p["meta"] for p in policies]
    t0 = time.perf_counter()
    for r in held:
        decide(r)
    run_s = time.perf_counter() - t0

    def cost(meta):
        return {"calls": len(meta), "usd": round(sum(m["api_equivalent"]["usd"] for m in meta), 4),
                "wall_s": round(sum(m["wall_s"] for m in meta), 1),
                "input_tokens": sum(m["api_equivalent"]["input_tokens"] for m in meta),
                "output_tokens": sum(m["api_equivalent"]["output_tokens"] for m in meta)}

    # Replay, rerun with a log of autonomous passes (results checked against replay.json).
    tm = {t["id"]: t for t in iter_jsonl(DATA / "heldout_timing.jsonl")}
    log = []
    again = replay(held, tm, decide, log=log)
    if again["totals"] != rep["outcome"]["C"]["totals"]:
        sys.exit("replay rerun differs from replay.json")
    c_types = Counter(case_type(r) for r in held if decide(r))
    cue_types = [t for t, _ in c_types.most_common(10)]
    for e in rep["outcome"]["C"]["events"]:
        if e["type"] not in cue_types:
            cue_types.append(e["type"])

    def states(events):
        out = {}
        for t in cue_types:
            row, cur = [], "standby"
            evs = {e["week"]: e["event"] for e in events if e["type"] == t}
            for wk in [x["week"] for x in again["timeline"]]:
                if wk in evs:
                    cur = "go" if evs[wk] == "promoted" else "cut"
                row.append(cur)
            out[t] = row
        return out

    agr = {}
    for a in ("0.5", "0.7", "0.9"):
        x = rep["agreement"][a]
        passed = sorted(r["passed"] for r in x["reps"])
        agr[a] = {"wrong_median": x["wrong_median"], "wrong_range": x["wrong_range"],
                  "passed_median": statistics.median(passed),
                  "first": sorted(r["first_promotion"] for r in x["reps"] if r["first_promotion"]),
                  "promoted_runs": sum(1 for r in x["reps"] if r["first_promotion"])}
    ex = rep["agreement"]["0.9_example"]

    def inv(r, **extra):
        return {"id": r["id"], "type": case_type(r), "value": r.get("invoice_value"),
                "straight_through": bool(r["straight_through"]), **extra}

    b_err = {r["id"] for r in sample if b_dec[r["id"]] and not r["straight_through"]}
    c_err = {r["id"] for r in sample if decide(r) and not r["straight_through"]}
    drawer = {
        "c_wrong_held_out": [inv(r) for r in held if decide(r) and not r["straight_through"]],
        "b_passes_sample": [inv(r) for r in sample if b_dec[r["id"]]],
        "c_only_errors_sample": [inv(by_id[i]) for i in sorted(c_err - b_err)],
        "replay_autonomous": [inv(by_id[x["id"]], week=x["week"]) for x in log],
    }

    data = {
        "built": time.strftime("%Y-%m-%d"),
        "source": {"name": "BPI Challenge 2019", "licence": "CC BY 4.0",
                   "doi": "10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1"},
        "log": {"raw": checks["raw"], "kept": analysis["kept"], "users": analysis["users"],
                "excluded": {k: v["count"] for k, v in checks["excluded"].items()},
                "flagged_before_creation": analysis["flagged"]["before_creation_events"].get("count")},
        "work": work,
        "candidates": cands["ranked"],
        "bar": {"z": Z, "bar": 0.99, "min_calls": [{"errors": e, "calls": min_calls(e)} for e in range(4)],
                "pass_everything": {k: kn(v.get("pooled", v)) for k, v in res_a["pass_everything"].items()}},
        "held_out_n": len(held), "sample_n": len(sample),
        "a": {"cells": len(res_a["rule_a"]["passing_cells"]), "held_out": kn(compare["A_held_out"])},
        "policies": pols, "chosen_policy": chosen,
        "b": {"sample": {"passed": sum(b_dec.values()), "errors": compare["B_vs_C_sample"]["B_errors"]},
              "lower": wilson(sum(b_dec.values()) - compare["B_vs_C_sample"]["B_errors"], sum(b_dec.values()))[0]},
        "c_sample": {"passed": len(c_sample_pass), "errors": compare["B_vs_C_sample"]["C_errors"]},
        "b_vs_c": compare["B_vs_C_sample"],
        "cost": {"b": cost(b_meta), "c": cost(c_meta), "c_run_s_all_held_out": round(run_s, 3)},
        "replay": {"weeks": [x["week"] for x in again["timeline"]], "timeline": again["timeline"],
                   "events": again["events"], "totals": again["totals"], "first": again["first_promotion"],
                   "cue_types": cue_types, "c_passes_by_type": {t: c_types[t] for t in cue_types},
                   "states": states(again["events"]),
                   "a_promoted": len(rep["outcome"]["A"]["promoted_types"])},
        "agreement": {"alphas": agr, "example_states": states(ex["events"]), "example_events": ex["events"],
                      "example_first": ex["first_promotion"]},
        "drawer": drawer,
        "adrs": adrs(),
        "lookahead": load_json(DATA / "lookahead.json"),
    }
    OUT.parent.mkdir(exist_ok=True)
    save_json(data, OUT, separators=(",", ":"))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
