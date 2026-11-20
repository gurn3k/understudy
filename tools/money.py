"""Figures for the money sections (ADR 0021). Pure functions; tools/build_site.py calls them and
writes the results into site/data.json, so no money figure on the page is typed by hand.

The unit throughout is the order line: the log has no invoice-document field, so one "invoice" in
the study is one order line. A (purchase order, first-receipt minute) group is shown as a proxy for
the number of invoice documents.
"""
import math
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from understudy.evaluate import wilson  # noqa: E402
from understudy.triage import CLR, IR  # noqa: E402

RPB = "Remove Payment Block"
ISOLATED = 10  # a manual step is "isolated" when its (user, minute, activity) group has fewer than this many events


def window(events):
    """(first receipt index, first clearing after it) or None when the line never cleared."""
    fi = next((i for i, e in enumerate(events) if e["act"] == IR), None)
    if fi is None:
        return None
    cl = next((i for i in range(fi + 1, len(events)) if events[i]["act"] == CLR), None)
    return None if cl is None else (fi, cl)


def footprint(cases, paid_ids, held_ids):
    """One pass over the log. Counts, on order lines, what the log shows of people's hands.

    - isolated: paid lines with at least one manual step other than the clearing itself, between the first
      receipt and the clearing, whose (user, minute, activity) group is smaller than ISOLATED events
      across the whole log. Bulk postings (one user, one minute, many lines) don't count.
    - rpb_manual: lines with a manual "Remove Payment Block" in that window, on held-out and on paid lines.
    - groups: distinct (purchase order, first-receipt minute) pairs, a proxy for invoice documents.
    It is a footprint, not proof of review: the log can show neither a review nor its absence.
    """
    groups = Counter()
    keep = {}
    for c in cases:
        evs = c["events"]
        for e in evs:
            if e["kind"] == "manual":
                groups[(e["user"], e["ts"][:16], e["act"])] += 1
        if c["id"] not in held_ids:
            continue
        w = window(evs)
        if w is None:
            continue
        fi, cl = w
        win = evs[fi + 1:cl]
        keys = [(e["user"], e["ts"][:16], e["act"]) for e in win if e["kind"] == "manual" and e["act"] != CLR]
        rpb = any(e["act"] == RPB and e["kind"] == "manual" for e in win)
        keep[c["id"]] = (keys, rpb, (c["id"].split("_")[0], evs[fi]["ts"][:16]))
    paid = [i for i in paid_ids if i in keep]
    held = [i for i in held_ids if i in keep]
    return {
        "paid_lines": len(paid), "held_lines": len(held),
        "isolated_paid": sum(1 for i in paid if any(groups[k] < ISOLATED for k in keep[i][0])),
        "rpb_manual_paid": sum(1 for i in paid if keep[i][1]),
        "rpb_manual_held": sum(1 for i in held if keep[i][1]),
        "groups_paid": len({keep[i][2] for i in paid}),
        "groups_held": len({keep[i][2] for i in held}),
    }


def lines_per_mistake(paid, wrong):
    """Paid lines per mistake: the point, and the range from the 95% interval on the error rate.

    Returns (point, cautious, generous): cautious uses the interval's worst error rate (fewest lines per
    mistake), generous its best.
    """
    lo, hi = wilson(paid - wrong, paid)  # interval on the share fine
    return paid / wrong, 1 / (1 - lo), 1 / (1 - hi)


def switch_off_threshold(n, bar=0.99):
    """Fewest wrong among n settled calls at which the switch-off fires (Wilson upper bound below the bar)."""
    for k in range(n + 1):
        if wilson(n - k, n)[1] < bar:
            return k
    return None


def switch_off_power(n, q, bar=0.99):
    """Chance the switch-off fires on a window of n calls when the true error rate is q."""
    t = switch_off_threshold(n, bar)
    return 1 - sum(math.comb(n, i) * q ** i * (1 - q) ** (n - i) for i in range(t))


def blind_sample(q=0.02, power=0.8, step=50, bar=0.99, limit=5000):
    """Smallest window, in steps of `step`, whose switch-off catches a true error rate q with at least `power`."""
    for n in range(step, limit + 1, step):
        if switch_off_power(n, q, bar) >= power:
            return n
    return None


def value_anchors(paid_values, wrong_values):
    """Mean value of a mistaken line, with all lines and with the largest tenth of paid lines sent to a person.

    The tenth's line is drawn from the paid lines themselves (as on the page): a description, not a tested limit.
    """
    pv = sorted(paid_values)
    line = pv[int(len(pv) * 0.9)]
    below = [v for v in wrong_values if v < line]
    return {"mean_wrong": statistics.fmean(wrong_values), "mean_wrong_below_top10": statistics.fmean(below),
            "wrong_below_top10": len(below), "line": line}
