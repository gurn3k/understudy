"""Earned-autonomy replay (docs/adr/0013, 0014).

Each case type starts in shadow mode. Invoices arrive in the week of their
first invoice receipt; a call's outcome becomes evidence in the week the
invoice cleared. A type is promoted when its resolved straight-through calls
pass the trust rule; it is demoted when the upper bound of its last 200
resolved autonomous calls falls below the bar.

The agreement gate is the same loop, except promotion counts simulated
reviewer agreement (known the week of review) instead of outcomes.
"""
import random
from collections import defaultdict
from datetime import datetime, timedelta

from understudy.evaluate import BAR, case_type, wilson

DEMOTE_WINDOW = 200


def week(ts):
    y, w, _ = datetime.fromisoformat(ts).isocalendar()
    return f"{y}-W{w:02d}"


def all_weeks(labels):
    """Every ISO week from the earliest to the latest label, with none skipped."""
    if not labels:
        return []
    start = datetime.fromisocalendar(*_parts(min(labels)), 1)
    end = datetime.fromisocalendar(*_parts(max(labels)), 1)
    out = []
    while start <= end:
        y, w, _ = start.isocalendar()
        out.append(f"{y}-W{w:02d}")
        start += timedelta(days=7)
    return out


def _parts(label):
    y, w = label.split("-W")
    return int(y), int(w)


def reviewer(alpha, catch=0.8, false_flag=0.02, seed=20261115):
    """Simulated reviewer for straight-through calls. Returns agree(label) -> bool."""
    rng = random.Random(seed)

    def agree(clean):
        if rng.random() < alpha:
            return True                     # anchored: copies the suggestion
        if clean:
            return rng.random() >= false_flag
        return rng.random() >= catch        # misses a real exception
    return agree


def replay(records, timing, decide, gate="outcome", agree=None):
    """records: labelled held-out invoices. timing: {id: {invoice_ts, clear_ts, manual_touches}}.
    decide(record) -> bool. gate: "outcome" or "agreement" (needs agree)."""
    arrivals = defaultdict(list)
    for r in records:
        arrivals[week(timing[r["id"]]["invoice_ts"])].append(r)
    resolve_at = {r["id"]: week(timing[r["id"]]["clear_ts"]) for r in records}
    weeks = all_weeks(list(arrivals) + list(resolve_at.values()))

    mode = defaultdict(lambda: "shadow")
    evidence = defaultdict(list)      # type -> [(resolve_week, correct)] since last reset
    agreement = defaultdict(list)     # type -> [agreed] since last reset (agreement gate)
    autonomous = defaultdict(list)    # type -> [(resolve_week, correct)] while autonomous
    promoted_week = {}
    timeline, events = [], []
    totals = {"passed": 0, "wrong": 0, "touches_removed": 0}

    for w in weeks:
        passed = wrong = removed = 0
        for r in sorted(arrivals[w], key=lambda x: x["id"]):
            t = case_type(r)
            if not decide(r):
                continue
            item = (resolve_at[r["id"]], bool(r["straight_through"]))
            if mode[t] == "autonomous":
                autonomous[t].append(item)
                passed += 1
                if r["straight_through"]:
                    removed += timing[r["id"]]["manual_touches"]
                else:
                    wrong += 1
            else:
                evidence[t].append(item)
                if gate == "agreement":
                    agreement[t].append(agree(r["straight_through"]))
        # End of week: promote and demote on what is known by now.
        for t in sorted(set(evidence) | set(autonomous) | set(agreement)):
            if mode[t] == "shadow":
                if gate == "outcome":
                    done = [c for wk, c in evidence[t] if wk <= w]
                    k, n = sum(done), len(done)
                else:
                    k, n = sum(agreement[t]), len(agreement[t])
                lo, _ = wilson(k, n)
                if lo is not None and lo >= BAR:
                    mode[t] = "autonomous"
                    promoted_week.setdefault(t, w)
                    events.append({"week": w, "type": t, "event": "promoted", "evidence": [k, n]})
            else:
                done = [c for wk, c in autonomous[t] if wk <= w][-DEMOTE_WINDOW:]
                if len(done) >= DEMOTE_WINDOW:
                    _, hi = wilson(sum(done), len(done))
                    if hi < BAR:
                        mode[t] = "shadow"
                        evidence[t], agreement[t], autonomous[t] = [], [], []
                        events.append({"week": w, "type": t, "event": "demoted", "recent": [sum(done), len(done)]})
        totals["passed"] += passed
        totals["wrong"] += wrong
        totals["touches_removed"] += removed
        timeline.append({"week": w, "autonomous_types": sum(1 for v in mode.values() if v == "autonomous"),
                         "passed": passed, "wrong": wrong, "touches_removed": removed})
    first = min(promoted_week.values()) if promoted_week else None
    return {"gate": gate, "timeline": timeline, "events": events, "totals": totals,
            "first_promotion": first, "promoted_types": sorted(promoted_week)}
