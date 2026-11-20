"""Figures for the limits of the evidence: label sensitivity, clustering by purchase order, and a
post-hoc vendor baseline. Pure functions; tools/build_site.py calls them and writes the results into
site/data.json, so none of these figures is typed by hand on the page.

None of this changes the pre-registered verdict (ADR 0016). It shows how far the verdict moves when
the label, the independence assumption or the baseline is changed, and in which direction.
"""
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from understudy.evaluate import case_type, wilson  # noqa: E402
from understudy.triage import CLR, IR, is_corrective  # noqa: E402

CDI = "Change Delivery Indicator"
SEED, DRAWS = 20261120, 2000


def po_of(line_id):
    return line_id.split("_")[0]


def label_scan(cases, paid_ids, wrong_ids):
    """One pass over the log, on the lines a policy paid.

    - mix: for lines that needed a correction, how many show each corrective activity between the first
      receipt and the clearing (a line can show several).
    - cdi_only: wrong lines whose only correction in that window is a Change Delivery Indicator.
    - post_clear: lines scored fine that show a corrective activity after the clearing (not in the label),
      and how many of those have more than one invoice receipt.
    """
    mix, cdi_only, post, post_multi = Counter(), set(), 0, 0
    for c in cases:
        cid = c["id"]
        if cid not in paid_ids:
            continue
        evs = c["events"]
        fi = next((i for i, e in enumerate(evs) if e["act"] == IR), None)
        if fi is None:
            continue
        cl = next((i for i in range(fi + 1, len(evs)) if evs[i]["act"] == CLR), None)
        if cl is None:
            continue
        if cid in wrong_ids:
            acts = {e["act"] for e in evs[fi + 1:cl] if is_corrective(e["act"])}
            mix.update(acts)
            if acts == {CDI}:
                cdi_only.add(cid)
        elif any(is_corrective(e["act"]) for e in evs[cl + 1:]):
            post += 1
            post_multi += sum(1 for e in evs if e["act"] == IR) > 1
    return {"mix": dict(mix.most_common()), "cdi_only": sorted(cdi_only), "post_clear": post, "post_clear_multi_ir": post_multi}


def clusters(ids, wrong_ids):
    """[(lines, wrong)] per purchase order."""
    po = defaultdict(lambda: [0, 0])
    for i in ids:
        x = po[po_of(i)]
        x[0] += 1
        x[1] += i in wrong_ids
    return [tuple(x) for x in po.values()]


def design_effect(cl):
    """Variance of the share wrong under PO clustering (linearised ratio estimator) over the simple-random variance."""
    n, w, k = sum(a for a, _ in cl), sum(b for _, b in cl), len(cl)
    p = w / n
    if k < 2 or p in (0, 1):
        return 1.0
    v = k / (k - 1) * sum((b - p * a) ** 2 for a, b in cl) / n ** 2
    return v / (p * (1 - p) / n)


def clustered_lower(cl):
    """Wilson lower bound of the share fine, on the effective sample size n / design effect."""
    n, w = sum(a for a, _ in cl), sum(b for _, b in cl)
    ne = n / design_effect(cl)
    return wilson((1 - w / n) * ne, ne)[0]


def po_bootstrap(cl, seed=SEED, draws=DRAWS):
    """95% interval of the share fine, resampling whole purchase orders."""
    rng, out = random.Random(seed), []
    for _ in range(draws):
        n = w = 0
        for _ in range(len(cl)):
            a, b = cl[rng.randrange(len(cl))]
            n += a
            w += b
        out.append(1 - w / n)
    out.sort()
    return out[int(0.025 * draws)], out[int(0.975 * draws) - 1]


def clustering(ids, wrong_ids):
    cl = clusters(ids, wrong_ids)
    n, w = sum(a for a, _ in cl), sum(b for _, b in cl)
    return {"n": n, "wrong": w, "orders": len(cl), "lower": wilson(n - w, n)[0], "deff": design_effect(cl),
            "clustered_lower": clustered_lower(cl), "boot": list(po_bootstrap(cl))}


def sensitivity(paid_ids, wrong_ids, scan):
    """The label moved one way at a time: drop CDI-only corrections; count post-clearing corrections."""
    paid_ids = list(paid_ids)
    n, w = len(paid_ids), len(wrong_ids)
    no_cdi = set(wrong_ids) - set(scan["cdi_only"])
    single = scan["post_clear"] - scan["post_clear_multi_ir"]
    return {"cdi_only": len(scan["cdi_only"]),
            "drop_cdi": clustering(paid_ids, no_cdi),
            "post_clear": scan["post_clear"], "post_clear_multi_ir": scan["post_clear_multi_ir"],
            # Counting every post-clearing correction, or only those on single-receipt lines (the rest may belong to a later invoice).
            "post_clear_lower": wilson(n - w - scan["post_clear"], n)[0],
            "post_clear_single_lower": wilson(n - w - single, n)[0]}


VENDOR_KEYS = {
    "vendor, corrections, goods receipt": lambda r: (r["vendor"], r["corrections_before_invoice"] > 0, bool(r["gr_before_invoice"])),
    "kind, corrections, goods receipt, vendor": lambda r: (case_type(r), r["corrections_before_invoice"] > 0, bool(r["gr_before_invoice"]), r["vendor"]),
    "vendor, corrections": lambda r: (r["vendor"], r["corrections_before_invoice"] > 0),
    "vendor": lambda r: r["vendor"],
}


def vendor_panel(fit, held, bar=0.99):
    """A post-hoc baseline that may use the vendor: pay a cell when its learning-month record proves the bar.
    The same selection rule as the study's own (highest learning-month coverage among keys that meet the bar per cell)
    picks the key. Written after the results were known: a check on the baseline, not a pre-registered contender."""
    rows = []
    for name, kf in VENDOR_KEYS.items():
        st = defaultdict(lambda: [0, 0])
        for r in fit:
            s = st[kf(r)]
            s[1] += 1
            s[0] += r["straight_through"]
        ok = {c for c, (a, b) in st.items() if (wilson(a, b)[0] or 0) >= bar}
        calls = [r for r in held if kf(r) in ok]
        wrong = {r["id"] for r in calls if not r["straight_through"]}
        cl = clusters([r["id"] for r in calls], wrong)
        n = len(calls)
        rows.append({"key": name, "fit_coverage": sum(1 for r in fit if kf(r) in ok) / len(fit),
                     "passed": n, "coverage": n / len(held), "wrong": len(wrong),
                     "lower": wilson(n - len(wrong), n)[0] if n else None,
                     "boot": list(po_bootstrap(cl)) if n else None, "vendors": len({r["vendor"] for r in calls})})
    best = max(rows, key=lambda x: x["fit_coverage"])
    return {"rows": rows, "picked": best["key"]}


def replay_errors(log, by_id):
    """Who the replay's autonomous mistakes fell on: kinds and purchase orders."""
    wrong = [by_id[x["id"]] for x in log if not by_id[x["id"]]["straight_through"]]
    po = Counter(po_of(r["id"]) for r in wrong)
    return {"wrong": len(wrong), "kinds": len({case_type(r) for r in wrong}), "kind": Counter(case_type(r) for r in wrong).most_common(1)[0][0] if wrong else None,
            "top_order": po.most_common(1)[0][1] if wrong else 0, "orders": len(po),
            "orders_paid": len({po_of(x["id"]) for x in log})}

