"""Stratified sample of held-out invoices, in proportion to case type."""
import random
from collections import defaultdict

from understudy.evaluate import case_type

SEED = 20261115
SIZE = 1500


def stratified(records, size=SIZE, seed=SEED):
    by_type = defaultdict(list)
    for r in records:
        by_type[case_type(r)].append(r)
    total = len(records)
    quotas = {t: size * len(v) / total for t, v in by_type.items()}
    alloc = {t: int(q) for t, q in quotas.items()}
    short = size - sum(alloc.values())
    for t in sorted(quotas, key=lambda t: (-(quotas[t] - alloc[t]), t))[:short]:
        alloc[t] += 1
    rng = random.Random(seed)
    out = []
    for t in sorted(by_type):
        pool = sorted(by_type[t], key=lambda r: r["id"])
        out.extend(rng.sample(pool, alloc[t]))
    return sorted(out, key=lambda r: r["id"])
