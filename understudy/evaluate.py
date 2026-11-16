"""Score straight-through calls against what actually happened.

A call is True (straight through) or False (leave to a person). Precision is
the share of straight-through calls whose invoice really needed no correction.
"""
import math
from collections import defaultdict

Z = 1.959963984540054  # two-sided 95%
BAR = 0.99
MIN_CALLS = 381        # fewest straight-through calls that can reach the bar (0 errors)


def wilson(k, n):
    """95% Wilson interval for k successes out of n. (None, None) when n == 0."""
    if n == 0:
        return None, None
    p = k / n
    d = 1 + Z * Z / n
    c = p + Z * Z / (2 * n)
    s = Z * math.sqrt(max(0.0, p * (1 - p) / n + Z * Z / (4 * n * n)))
    return (c - s) / d, (c + s) / d


def case_type(r):
    return f"{r.get('category') or '(none)'} / {r.get('spend_area') or '(none)'}"


def verdict(correct, calls):
    lo, _ = wilson(correct, calls)
    if lo is not None and lo >= BAR:
        return "helper-ready"
    if calls < MIN_CALLS:
        return "not enough evidence"
    return "not ready"


def _block(rows):
    total = len(rows)
    clean = sum(1 for r, _ in rows if r["straight_through"])
    calls = [(r, d) for r, d in rows if d]
    correct = sum(1 for r, _ in calls if r["straight_through"])
    lo, hi = wilson(correct, len(calls))
    return {
        "invoices": total,
        "clean": clean,
        "calls": len(calls),
        "correct": correct,
        "wrong": len(calls) - correct,
        "precision": [correct, len(calls)],
        "coverage": [len(calls), total],
        "recall": [correct, clean],
        "precision_lower": lo,
        "precision_upper": hi,
        "verdict": verdict(correct, len(calls)),
        "wrong_ids": sorted(r["id"] for r, _ in calls if not r["straight_through"]),
        "passed_ids": sorted(r["id"] for r, _ in calls),
    }


def evaluate(records, decide):
    """decide(record) -> bool. Returns pooled and per-type results."""
    by_type = defaultdict(list)
    rows = []
    for r in records:
        row = (r, bool(decide(r)))
        rows.append(row)
        by_type[case_type(r)].append(row)
    pooled = _block(rows)
    pooled["coverage_at_bar"] = (pooled["calls"] / pooled["invoices"]
                                 if pooled["precision_lower"] is not None and pooled["precision_lower"] >= BAR
                                 and pooled["invoices"] else 0.0)
    return {"pooled": pooled, "types": {t: _block(v) for t, v in sorted(by_type.items())}}
