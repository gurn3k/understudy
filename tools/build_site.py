"""Build site/data.json from the analysis outputs. Every figure on the page comes from here.

Usage: python tools/build_site.py [--retime]
--retime re-measures the rulebook's run time; without it the committed value in site/data.json is kept.
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
import money  # noqa: E402  (tools/money.py)
import evidence  # noqa: E402  (tools/evidence.py)

DATA = Path(os.environ.get("LOCALAPPDATA", "")) / "understudy" / "data"
OUT = ROOT / "site" / "data.json"
KEYS = ("precision", "coverage", "precision_lower")


# Changes made after a held-out result was known, one per decision record or amendment (ADR 0022).
# kind: bar (moved the bar), rule (changed a rule), run (added a run), lookahead (disclosed a look-ahead), fix (corrected),
# added (written after). The bar row's base rate is filled in main() from the test months.
POST_RESULT = [
    ["bar", "The trust bar", "ADR 0010", "Raised from 90% to 99% after the test months' base rate ({base}) showed a do-nothing rule would pass; before any contender ran.", "A stricter bar; no contender had run."],
    ["rule", "How the approaches are compared", "ADR 0015", "Replaced after the first rulebook's test result was known, before the other contenders ran.", "None: the verdict is shown under both rules, and they agree."],
    ["run", "A second run of Claude checking each invoice", "ADR 0018", "Run on 10,000 new invoices after the first sample proved too small; prompt, model and settings unchanged.", "None: not proven, as before."],
    ["lookahead", "Which decision to study", "ADR 0006, amendment 2", "Found after all runs: how rule-like each decision is was scored on the test months, so test outcomes helped choose invoices as the subject.", "Not rerun. A look-ahead in the choice of subject, not in any contender's inputs."],
    ["lookahead", "The learning months' rates", "ADR 0012, amendment 1", "Found after all runs: rates from January to May include outcomes that landed after the test began.", "Not rerun. A look-ahead in every contender's inputs; its direction is not established."],
    ["fix", "The replay's last 200 calls", "ADR 0013, amendment 2", "Clarified after the replay ran: counted in arrival order, as run. A different order was considered and not adopted.", "None."],
    ["fix", "The replay's touch count", "ADR 0013, amendment 3; ADR 0017, erratum 2", "Code corrected after the replay ran: 788 became 785.", "One figure."],
    ["fix", "Agreement-gate sentences", "ADR 0017, erratum 1", "A misread list corrected after the ruling.", "Wording and two figures."],
    ["added", "The business case and the pilot request", "ADRs 0019, 0020, 0021, 0025, 0026, 0027, 0028", "Written after the verdict, and re-based and tightened after outside reviews.", "None: no verdict, bar or fixed sentence."],
    ["added", "How the page words its limits", "ADRs 0022 to 0024", "Rewritten after an outside review: this table, the sensitivity checks, a supplier baseline checked after the fact, and the plain wording.", "None."],
    ["added", "A later check on September 2018", "ADR 0029", "Fixed in advance after an outside review and run once on lines no part of the study had used; the comparison months were re-scored under the same window first.", "The pilot request's supplier-rule requirement (M11) now refits the rule in Phase 0, and Q3's wording on the supplier rule was updated to match. No verdict, bar or fixed sentence."],
]



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


CONFIRM = ROOT / "docs" / "confirm" / "sept-2018-result.json"


def confirm_summary(path=CONFIRM):
    """The later check on September 2018 (ADR 0029), from its committed output; None until it has run."""
    if not path.exists():
        return None
    r = load_json(path)

    def fig(x):
        return None if x is None else {k: x[k] for k in ("n", "wrong", "fine_share", "interval")}

    def pooled(s):
        return {"lines": s["lines"], "approaches": {a: {k: v["pooled"][k] for k in ("paid", "wrong", "stuck", "stuck_share")}
                                                     | {"main": fig(v["pooled"]["main"]), "worst": fig(v["pooled"]["worst"])}
                                                     for a, v in s["approaches"].items()}}
    sec = r["secondary_all_invoiced_in_september"]
    return {"month": r["month"], "window_days": r["window_days"],
            "september": pooled(r["september"]) | {"stuck_by_kind": r["september"]["stuck_by_kind"]},
            "june_august": pooled(r["june_august"]), "june_august_test_file": pooled(r["june_august_test_file"]),
            "readings": r["readings"], "readings_against_test_file": r["readings_against_test_file"],
            "june_august_against_itself": r["june_august_against_itself"], "consequences": r["consequences"],
            "secondary": pooled(sec["scores"]) | {"readings": sec["readings"], "in_test_file": sec["in_test_file"],
                                                  "in_learning_file": sec["in_learning_file"]}}


def b2_summary(cost):
    """The follow-up run of B (ADR 0018): its scored result and its own cost."""
    if not (DATA / "b2_result.json").exists():
        return None
    res = load_json(DATA / "b2_result.json")
    meta = [row["meta"] for b in range(1, res["blocks"] + 1)
            for row in load_json(DATA / f"b2_live_block_{b:02d}.json")["log"]]
    return {**res, "cost": cost(meta)}


def kept_run_time(measured, path=OUT, retime=False):
    """The run time is re-measured on every build and differs only by noise, so the committed value stays
    unless --retime is passed (or there is none yet)."""
    if not retime and path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))["cost"]["c_run_s_all_held_out"]
        except (KeyError, TypeError, ValueError):
            pass
    return round(measured, 3)


def main(retime=False):
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

    # Business case (ADR 0019, re-based on order lines in ADR 0021): written after the verdict. Changes no result.
    paid = [r for r in held if decide(r)]
    wrong = [r for r in paid if not r["straight_through"]]
    val = lambda rs: [r.get("invoice_value") or 0 for r in rs]  # noqa: E731
    pv = sorted(val(paid))
    top_line = pv[int(len(pv) * 0.9)]
    top_wrong = [v for v in val(wrong) if v >= top_line]
    paper, paper_cautious, _ = money.lines_per_mistake(len(paid), len(wrong))
    tot = again["totals"]
    gated, gated_cautious, gated_generous = money.lines_per_mistake(tot["passed"], tot["wrong"])
    auto_wrong_po = Counter(x["id"].split("_")[0] for x in log if not by_id[x["id"]]["straight_through"])
    fp = money.footprint(iter_jsonl(DATA / "cases.jsonl"), {r["id"] for r in paid}, set(by_id))
    if fp["paid_lines"] != len(paid) or fp["held_lines"] != len(held):
        sys.exit("footprint: every held-out line should have a clearing window")
    blind_n = money.blind_sample(q=0.02, power=0.8)
    business = {
        "unit": "order line",
        "paid": len(paid), "wrong": len(wrong), "problems_all": sum(1 for r in held if not r["straight_through"]),
        "months": 3,
        # The log has no invoice-document field: (purchase order, first-receipt minute) groups stand in for documents.
        "groups_paid": fp["groups_paid"], "groups_held": fp["groups_held"],
        # What the log shows of people's hands on these lines: a footprint, not proof of review.
        "footprint": {k: fp[k] for k in ("isolated_paid", "isolated_paid_lt5", "any_manual_paid", "rpb_manual_paid", "rpb_manual_held")},
        # Paid lines per mistake: on paper (the test, trusted from day one) and gated (the replay, trust earned).
        "lines_per_mistake": {"paper": paper, "paper_cautious": paper_cautious,
                              "gated": gated, "gated_cautious": gated_cautious, "gated_generous": gated_generous},
        "gated": {"passed": tot["passed"], "wrong": tot["wrong"], "top_order_wrong": auto_wrong_po.most_common(1)[0][1],
                  "orders_wrong": len(auto_wrong_po), "earned_share": tot["passed"] / len(paid)},
        # Blind checks per kind per window to catch a true 2% error rate 80% of the time with the switch-off test.
        "blind": {"n": blind_n, "q": 0.02, "power": money.switch_off_power(blind_n, 0.02),
                  "fires_at": money.switch_off_threshold(blind_n),
                  "first_n": money.first_powered(0.02, 0.8), "power_1000": money.switch_off_power(1000, 0.02)},
        # Invoice values are recorded in EUR (order-line net value); the page shows USD at the ECB's 2018 average.
        "eur_usd": 1.1810,
        "value": {"held": sum(val(held)), "paid": sum(pv), "wrong": sum(val(wrong)),
                  "median_paid": statistics.median(pv), "median_wrong": statistics.median(val(wrong))},
        "anchors": money.value_anchors(pv, val(wrong)),
        "top10": {"line": top_line, "count": sum(1 for v in pv if v >= top_line), "wrong": len(top_wrong), "wrong_value": sum(top_wrong),
                  "paid_value": sum(v for v in pv if v >= top_line)},
    }

    # Limits of the evidence (ADR 0022): label sensitivity, clustering by purchase order, a post-hoc vendor baseline,
    # where the replay's mistakes fell, and the agreement-gate sweep (tools/run_sweep.py). None changes the verdict.
    paid_ids, wrong_ids = [r["id"] for r in paid], {r["id"] for r in wrong}
    scan = evidence.label_scan(iter_jsonl(DATA / "cases.jsonl"), set(paid_ids), wrong_ids)
    fit = list(iter_jsonl(DATA / "invoice_triage_fit.jsonl"))
    b_pass = [r for r in sample if b_dec[r["id"]]]
    sweep = load_json(DATA / "agreement_sweep.json") if (DATA / "agreement_sweep.json").exists() else None
    ev = {
        "mix": scan["mix"], "clustering": evidence.clustering(paid_ids, wrong_ids),
        "sensitivity": evidence.sensitivity(paid_ids, wrong_ids, scan),
        "vendor": evidence.vendor_panel(fit, held),
        "replay": evidence.replay_errors(log, by_id),
        # Every rulebook's held-out bound under purchase-order clustering (policy 1 cleared the bar only on independence).
        "policy_clustering": {i + 1: evidence.clustering([r["id"] for r in held if dp(r)], {r["id"] for r in held if dp(r) and not r["straight_through"]})
                              for i, dp in enumerate(C.decider(pp["reply"]) for pp in policies)},
        # Claude checking each invoice, on the first sample: how many of its passes the rulebook also paid.
        "b_in_c": {"b_passed": len(b_pass), "also_c": sum(1 for r in b_pass if decide(r)),
                   "c_on_b": sum(1 for r in b_pass if decide(r) and not r["straight_through"])},
        "sweep": sweep["cells"] if sweep else None,
        # The rulebook's paid lines with whole suppliers as the units (ADR 0025).
        "rulebook_by_vendor": evidence.vendor_clustering(paid, wrong_ids),
        # The "invoice before GR" category is an order setting, not the order of events: how many of its test lines
        # had a goods receipt before the first invoice receipt anyway.
        "kind_setting": {"before_gr_lines": sum(1 for r in held if r["category"] == "3-way match, invoice before GR"),
                         "before_gr_gr_first": sum(1 for r in held if r["category"] == "3-way match, invoice before GR" and r["gr_before_invoice"])},
    }

    # The pilot request's controls (ADR 0025): the switch-off test in numbers, blind-check power, and how the
    # replay's promotions fired. All from the same functions the replay and the cost model use.
    from understudy.evaluate import wilson as _wilson
    from understudy.replay import DEMOTE_WINDOW
    fires = money.switch_off_threshold(DEMOTE_WINDOW)
    # Control defaults: my assumptions, not tested values; the page reads them from here (one source).
    dflt = {"margin": 0.993, "consec": 3, "order_cap": 3, "settle_days": 30, "budget_share": 0.01, "blind_quarter_windows": 4}

    # M2's default on the replay: worst likely case allowing for orders at or above the margin at `consec` looks in a row.
    streak = {}

    def m2_default(t, settled, w):
        ids = [i for _, i in settled]
        wrong_ids = {i for c, i in settled if not c}
        ok = bool(ids) and evidence.clustered_lower(evidence.clusters(ids, wrong_ids)) >= dflt["margin"]
        streak[t] = streak.get(t, 0) + 1 if ok else 0
        return streak[t] >= dflt["consec"]
    m2 = replay(held, tm, decide, promote=m2_default)
    capped = replay(held, tm, decide, order_cap=dflt["order_cap"])

    def calls_at(bar, errors):
        n = errors + 1
        while wilson(n - errors, n)[0] < bar:
            n += 1
        return n

    # M3's second test: the lower end of the error interval on calls paid alone since promotion rises above the upper
    # end of the error interval the kind was promoted on. Errors at which it fires, on 200 and on 1,000 calls.
    def second_test(k, n, calls):
        up = 1 - wilson(k, n)[0]
        return next(e for e in range(calls + 1) if 1 - wilson(calls - e, calls)[1] > up)

    lags = evidence.settle_lags(iter_jsonl(DATA / "cases.jsonl"), set(paid_ids))
    per_kind = Counter(case_type(r) for r in paid)
    first_kind = next(e["type"] for e in again["events"] if e["event"] == "promoted")
    first_kind_month = per_kind[first_kind] / business["months"]
    controls = {
        "window": DEMOTE_WINDOW, "fires_at": fires,
        "tolerated_upper": _wilson(DEMOTE_WINDOW - (fires - 1), DEMOTE_WINDOW)[1],
        "tolerated_lower": _wilson(DEMOTE_WINDOW - (fires - 1), DEMOTE_WINDOW)[0],
        "fires_upper": _wilson(DEMOTE_WINDOW - fires, DEMOTE_WINDOW)[1],
        "power_window": money.switch_off_power(DEMOTE_WINDOW, 0.02),
        "small_n": 400, "power_400": money.switch_off_power(400, 0.02),
        "promotions": [{**e, "lower": _wilson(*e["evidence"])[0]} for e in again["events"] if e["event"] == "promoted"],
        "demotions": [{**e, "upper": _wilson(*e["recent"])[1]} for e in again["events"] if e["event"] == "demoted"],
        "looks": sum(len(v) for v in states(again["events"]).values()), "kinds": len(states(again["events"])),
        "clustered_calls": [{"errors": e, "calls": min_calls(e), "clustered": min_calls(e) * ev["clustering"]["deff"],
                             "margin_calls": calls_at(dflt["margin"], e), "margin_clustered": calls_at(dflt["margin"], e) * ev["clustering"]["deff"]}
                            for e in range(4)],
        "defaults": dflt,
        # Weekly looks the gate itself took: shadow-mode kind-weeks with at least one settled call.
        "gate_looks": again["looks"], "gate_kinds": again["looked_types"],
        "m2_default": {"promotions": sum(1 for e in m2["events"] if e["event"] == "promoted"), "passed": m2["totals"]["passed"],
                       "wrong": m2["totals"]["wrong"], "first": m2["first_promotion"]},
        "order_cap": {"passed": capped["totals"]["passed"], "wrong": capped["totals"]["wrong"]},
        "budget_count_replay": int(dflt["budget_share"] * again["totals"]["passed"]),
        "second_test": [{"week": e["week"], "evidence": e["evidence"], "err_upper": 1 - wilson(*e["evidence"])[0],
                         "fires_200": second_test(*e["evidence"], 200), "fires_1000": second_test(*e["evidence"], 1000)}
                        for e in again["events"] if e["event"] == "promoted"],
        "settle": {"lines": len(lags), "median_days": statistics.median(lags) if lags else None,
                   "within": {str(d): (sum(1 for x in lags if x <= d) / len(lags)) if lags else None for d in (30, 60, 90)}},
        "kinds_paid": len(per_kind), "kinds_month_full": sum(1 for v in per_kind.values() if v / business["months"] >= blind_n),
        "first_kind_month": first_kind_month, "power_first_kind_month": money.switch_off_power(int(first_kind_month), 0.02),
        "kind_months": sorted((v / business["months"] for v in per_kind.values()), reverse=True),
        # M15 (no goods receipt yet means hold): counted after the results were known; describes the lines, tests no rule.
        "no_gr": {"paid": sum(1 for r in paid if not r["gr_before_invoice"]),
                  "wrong": sum(1 for r in paid if not r["gr_before_invoice"] and not r["straight_through"])},
    }

    pe_rate = sum(1 for r in held if r["straight_through"]) / len(held)
    data = {
        "built": time.strftime("%Y-%m-%d"),
        "evidence": ev,
        "controls": controls,
        "post_result": [[k, w, r, h.format(base=f"{pe_rate:.1%}"), e] for k, w, r, h, e in POST_RESULT],
        "business": business,
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
        "cost": {"b": cost(b_meta), "c": cost(c_meta), "c_run_s_all_held_out": kept_run_time(run_s, retime=retime)},
        "replay": {"weeks": [x["week"] for x in again["timeline"]], "timeline": again["timeline"],
                   "events": again["events"], "totals": again["totals"], "first": again["first_promotion"],
                   "cue_types": cue_types, "c_passes_by_type": {t: c_types[t] for t in cue_types},
                   "states": states(again["events"]),
                   "a_promoted": len(rep["outcome"]["A"]["promoted_types"])},
        "agreement": {"alphas": agr, "example_states": states(ex["events"]), "example_events": ex["events"],
                      "example_first": ex["first_promotion"],
                      "example_timeline": [{k: x[k] for k in ("week", "passed", "wrong")} for x in ex["timeline"]],
                      "example_totals": ex["totals"]},
        "drawer": drawer,
        "adrs": adrs(),
        "lookahead": load_json(DATA / "lookahead.json"),
        "b2": b2_summary(cost),
        "confirm": confirm_summary(),
    }
    OUT.parent.mkdir(exist_ok=True)
    save_json(data, OUT, separators=(",", ":"))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(retime="--retime" in sys.argv[1:])
