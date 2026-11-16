"""Independent recount of every published figure, straight from the raw XES.

It deliberately shares no code with the understudy package: it scans text
with regular expressions and applies the rules as written in docs/PRD.md
and the ADRs. It then compares its figures with checks.json and
analysis.json, and exits non-zero on any difference.

Usage: python tools/recount.py <log.xes> <checks.json> <analysis.json>
"""
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

ATTR = re.compile(r'<(string|date|float|boolean) key="([^"]*)" value="([^"]*)"')
UNESC = [("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&apos;", "'"), ("&amp;", "&")]
LO = datetime(2017, 1, 1, tzinfo=timezone.utc)
HI = datetime(2020, 1, 1, tzinfo=timezone.utc)


def unesc(v):
    for a, b in UNESC:
        v = v.replace(a, b)
    return v


def when(v):
    try:
        t = datetime.fromisoformat(v) if v else None
    except ValueError:
        return None
    if t is None:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return t.astimezone(timezone.utc)


def kind(u):
    return "batch" if u.startswith("batch_") else "manual" if u.startswith("user_") else "unclassified"


def traces(path):
    """Yield (case attrs, events) using a text scan of <trace> blocks."""
    with open(path, encoding="utf-8") as f:
        data = f.read()  # the log is one long line; read once, then scan
    pos = 0
    while True:
        a = data.find("<trace>", pos)
        if a < 0:
            return
        b = data.find("</trace>", a)
        block = data[a + 7:b]
        pos = b + 8
        head = block.split("<event>", 1)[0]
        attrs = {k: unesc(v) for _, k, v in ATTR.findall(head)}
        evs = []
        for chunk in block.split("<event>")[1:]:
            chunk = chunk.split("</event>", 1)[0]
            d = {k: (t, unesc(v)) for t, k, v in ATTR.findall(chunk)}
            evs.append({
                "act": d.get("concept:name", (None, None))[1],
                "raw_ts": d.get("time:timestamp", (None, None))[1],
                "user": (d.get("User") or d.get("org:resource") or (None, "UNKNOWN"))[1],
                "worth": float(d["Cumulative net worth (EUR)"][1]) if "Cumulative net worth (EUR)" in d else None,
            })
        yield attrs, evs


def recount(path):
    raw = {"cases": 0, "events": 0}
    bad, dup, nocre = defaultdict(int), defaultdict(int), {}
    kept = {"cases": 0, "events": 0, "manual": 0, "batch": 0, "unclassified": 0}
    acts = defaultdict(lambda: {"events": 0, "manual": 0, "batch": 0, "unclassified": 0, "cases": set(), "rep": set()})
    users = {"manual": set(), "batch": set()}
    before, before_cases = 0, set()
    early, early_batch = set(), set()
    for attrs, evs in traces(path):
        cid = attrs.get("concept:name")
        raw["cases"] += 1
        raw["events"] += len(evs)
        seen, keep = set(), []
        for e in evs:
            t = when(e["raw_ts"])
            if t is None or not (LO <= t < HI):
                bad[cid] += 1
                continue
            sig = (e["act"], e["raw_ts"], e["user"], e["worth"])
            if sig in seen:
                dup[cid] += 1
                continue
            seen.add(sig)
            keep.append((t, e))
        if not any(e["act"] == "Create Purchase Order Item" for _, e in keep):
            nocre[cid] = len(keep)
            continue
        kept["cases"] += 1
        n_per = defaultdict(int)
        for t, e in keep:
            k = kind(e["user"])
            kept["events"] += 1
            kept[k] += 1
            a = acts[e["act"]]
            a["events"] += 1
            a[k] += 1
            a["cases"].add(cid)
            n_per[e["act"]] += 1
            if k in users:
                users[k].add(e["user"])
        for act, n in n_per.items():
            if n > 1:
                acts[act]["rep"].add(cid)
        c0 = min(t for t, e in keep if e["act"] == "Create Purchase Order Item")
        e_before = sum(1 for t, _ in keep if t < c0)
        if e_before:
            before += e_before
            before_cases.add(cid)
        if attrs.get("Item Category") == "3-way match, invoice before GR":
            grs = [t for t, e in keep if e["act"] == "Record Goods Receipt"]
            g0 = min(grs) if grs else None
            for t, e in sorted(keep, key=lambda x: x[0]):
                if e["act"] == "Remove Payment Block" and (g0 is None or t < g0):
                    early.add(cid)
                    if kind(e["user"]) == "batch":
                        early_batch.add(cid)
                    break
    return {
        "raw": raw,
        "excluded": {"bad_date_events": sum(bad.values()), "duplicate_events": sum(dup.values()),
                     "no_creation_cases": len(nocre)},
        "kept": kept,
        "users": {k: len(v) for k, v in users.items()},
        "activities": {a: {"events": v["events"], "manual": v["manual"], "batch": v["batch"],
                           "unclassified": v["unclassified"], "cases": len(v["cases"]),
                           "repeat_cases": len(v["rep"])} for a, v in acts.items()},
        "flagged": {"before_creation_events": before, "before_creation_cases": len(before_cases),
                    "early_release_cases": len(early), "early_release_by_batch": len(early_batch)},
    }


def compare(rc, checks, an):
    diffs = []

    def eq(label, a, b):
        if a != b:
            diffs.append(f"{label}: recount {a} vs published {b}")

    eq("raw", rc["raw"], checks["raw"])
    for k, v in rc["excluded"].items():
        eq(f"excluded {k}", v, checks["excluded"][k]["count"])
    eq("kept", rc["kept"], an["kept"])
    eq("users", rc["users"], an["users"])
    eq("activity names", sorted(rc["activities"]), sorted(an["activities"]))
    for a, v in rc["activities"].items():
        p = an["activities"].get(a, {})
        for f in ("events", "manual", "batch", "unclassified", "cases"):
            eq(f"{a} {f}", v[f], p.get(f))
        if isinstance(p.get("repeat"), list):
            eq(f"{a} repeat", [v["repeat_cases"], v["cases"]], p["repeat"])
    fl = an["flagged"]
    eq("before-creation events", rc["flagged"]["before_creation_events"], fl["before_creation_events"]["count"])
    eq("before-creation cases", rc["flagged"]["before_creation_cases"], len(fl["before_creation_events"]["cases"]))
    eq("early release cases", rc["flagged"]["early_release_cases"], fl["block_removed_before_goods_receipt"]["count"])
    eq("early release by batch", rc["flagged"]["early_release_by_batch"], fl["block_removed_before_goods_receipt"]["by_batch"])
    return diffs


if __name__ == "__main__":
    rc = recount(sys.argv[1])
    checks = json.load(open(sys.argv[2], encoding="utf-8"))
    an = json.load(open(sys.argv[3], encoding="utf-8"))
    diffs = compare(rc, checks, an)
    if diffs:
        print("RECOUNT FAILED")
        print("\n".join(diffs))
        sys.exit(1)
    print(f"recount matches: {rc['raw']['cases']} cases, {rc['raw']['events']} events, "
          f"{len(rc['activities'])} activities")
