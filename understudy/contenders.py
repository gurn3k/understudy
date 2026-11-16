"""Contender A (the rule) and the pass-everything reference.

B and C (the Claude contenders) live in their own modules.
"""
from collections import defaultdict

from understudy.evaluate import BAR, case_type, wilson


def cell(r):
    return (case_type(r), r["corrections_before_invoice"] > 0, bool(r["gr_before_invoice"]))


def fit_rule_a(records):
    """Cells from the earlier months whose straight-through rate passes the bar.
    Returns (passing cells, per-cell stats)."""
    stats = defaultdict(lambda: [0, 0])
    for r in records:
        if r["split"] != "fit":
            continue
        s = stats[cell(r)]
        s[1] += 1
        if r["straight_through"]:
            s[0] += 1
    passing = set()
    for c, (k, n) in stats.items():
        lo, _ = wilson(k, n)
        # Fewer than MIN_CALLS invoices can't reach the bar, so no separate size check.
        if lo is not None and lo >= BAR:
            passing.add(c)
    return passing, {c: list(v) for c, v in stats.items()}


def rule_a(passing):
    return lambda r: cell(r) in passing


def pass_everything(_r):
    return True
