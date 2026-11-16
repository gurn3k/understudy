"""Rank candidate decision points by manual volume x rule-likeness.

Rule-likeness: balanced accuracy on held-out months of the best single-field
lookup rule fitted on the earlier months (docs/adr/0006, amendment 1).
"""


def balanced_accuracy(y, yhat):
    """Mean of true-positive and true-negative rates. None if a class is absent."""
    pos = sum(1 for a in y if a)
    neg = len(y) - pos
    if pos == 0 or neg == 0:
        return None
    tp = sum(1 for a, b in zip(y, yhat) if a and b)
    tn = sum(1 for a, b in zip(y, yhat) if not a and not b)
    return (tp / pos + tn / neg) / 2


def fit_lookup(records, field, label):
    """Predict positive for a value whose fit-month positive rate beats the
    overall fit-month rate. Unseen values get the overall majority."""
    fit = [r for r in records if r["split"] == "fit"]
    base = sum(1 for r in fit if r[label]) / len(fit)
    counts = {}
    for r in fit:
        p, n = counts.get(r[field], (0, 0))
        counts[r[field]] = (p + (1 if r[label] else 0), n + 1)
    table = {v: (p / n) > base for v, (p, n) in counts.items()}
    default = base > 0.5
    return lambda r: table.get(r[field], default)


def rule_likeness(records, fields, label):
    """Pick the field whose rule scores best on the fitting months, then report
    that rule's balanced accuracy on the held-out months. Returns (score, field)."""
    fit = [r for r in records if r["split"] == "fit"]
    held = [r for r in records if r["split"] == "heldout"]
    best_field, best_fit = None, None
    for f in fields:
        rule = fit_lookup(records, f, label)
        ba = balanced_accuracy([bool(r[label]) for r in fit], [rule(r) for r in fit])
        if ba is not None and (best_fit is None or ba > best_fit):
            best_field, best_fit = f, ba
    if best_field is None:
        return None, None
    rule = fit_lookup(records, best_field, label)
    return balanced_accuracy([bool(r[label]) for r in held], [rule(r) for r in held]), best_field


def rank(candidates, analysis, batch_cap=0.8):
    """candidates: list of dicts with name, volume_activities, records, fields, label.
    Volume = manual events of the volume activities. A candidate whose volume
    activities are mostly batch already (share > batch_cap) can't rank."""
    out = []
    for c in candidates:
        manual = sum(analysis["activities"][a]["manual"] for a in c["volume_activities"])
        batch = sum(analysis["activities"][a]["batch"] for a in c["volume_activities"])
        share_batch = batch / (manual + batch) if manual + batch else 0.0
        ba, field = rule_likeness(c["records"], c["fields"], c["label"])
        signal = max(0.0, 2 * ba - 1) if ba is not None else 0.0
        out.append({
            "name": c["name"], "manual_events": manual, "batch_share": share_batch,
            "rule_likeness": ba, "best_field": field,
            "score": 0.0 if share_batch > batch_cap else manual * signal,
            "excluded_already_automated": share_batch > batch_cap,
        })
    return sorted(out, key=lambda x: -x["score"])
