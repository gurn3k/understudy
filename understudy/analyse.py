"""Where the manual work is: per-activity shares, repeats and flags.

Every figure keeps the case IDs behind it, so the page can open them.
Usage: python -m understudy.analyse <cases.jsonl> <analysis.json>
"""
import json
import sys
from collections import defaultdict

CREATE = "Create Purchase Order Item"
GR = "Record Goods Receipt"
RPB = "Remove Payment Block"
IBG = "3-way match, invoice before GR"

# Activities that repeat for normal reasons (partial deliveries and invoices).
MULTIPLE_EXPECTED = {
    "Record Goods Receipt",
    "Record Invoice Receipt",
    "Record Service Entry Sheet",
    "Vendor creates invoice",
}


def repeat_published(activity):
    """Repeat rate is published only for change and payment-block activities."""
    return activity.startswith("Change ") or activity in {RPB, "Set Payment Block"}


def analyse(cases):
    acts = defaultdict(lambda: {"events": 0, "manual": 0, "batch": 0, "unclassified": 0,
                                "case_ids": set(), "repeat_ids": set()})
    totals = {"cases": 0, "events": 0, "manual": 0, "batch": 0, "unclassified": 0}
    users = {"manual": set(), "batch": set()}
    before_creation = {"count": 0, "cases": set()}
    early_release = {"cases": set(), "by_batch": set()}

    for c in cases:
        cid = c["id"]
        evs = c["events"]
        totals["cases"] += 1
        per_case = defaultdict(int)
        for e in evs:
            a = acts[e["act"]]
            a["events"] += 1
            a[e["kind"]] += 1
            a["case_ids"].add(cid)
            per_case[e["act"]] += 1
            totals["events"] += 1
            totals[e["kind"]] += 1
            if e["kind"] in users:
                users[e["kind"]].add(e["user"])
        for act, n in per_case.items():
            if n >= 2:
                acts[act]["repeat_ids"].add(cid)

        first_create = min(e["ts"] for e in evs if e["act"] == CREATE)
        early = [e for e in evs if e["ts"] < first_create]
        if early:
            before_creation["count"] += len(early)
            before_creation["cases"].add(cid)

        if c.get("category") == IBG:
            gr_times = [e["ts"] for e in evs if e["act"] == GR]
            first_gr = min(gr_times) if gr_times else None
            for e in evs:
                if e["act"] == RPB and (first_gr is None or e["ts"] < first_gr):
                    early_release["cases"].add(cid)
                    if e["kind"] == "batch":
                        early_release["by_batch"].add(cid)
                    break

    activities = {}
    for act, a in acts.items():
        if repeat_published(act):
            repeat = [len(a["repeat_ids"]), len(a["case_ids"])]
        elif act in MULTIPLE_EXPECTED:
            repeat = "multiple expected"
        else:
            repeat = None
        activities[act] = {
            "events": a["events"], "manual": a["manual"], "batch": a["batch"],
            "unclassified": a["unclassified"], "cases": len(a["case_ids"]),
            "repeat": repeat,
            "case_ids": sorted(a["case_ids"]),
            "repeat_case_ids": sorted(a["repeat_ids"]) if repeat_published(act) else [],
        }
    return {
        "kept": totals,
        "users": {k: len(v) for k, v in users.items()},
        "activities": activities,
        "flagged": {
            "before_creation_events": {"count": before_creation["count"],
                                       "cases": sorted(before_creation["cases"])},
            "block_removed_before_goods_receipt": {
                "count": len(early_release["cases"]),
                "by_batch": len(early_release["by_batch"]),
                "cases": sorted(early_release["cases"]),
                "batch_cases": sorted(early_release["by_batch"]),
            },
        },
    }


def iter_jsonl(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield json.loads(line)


if __name__ == "__main__":
    result = analyse(iter_jsonl(sys.argv[1]))
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(result, f)
    print(json.dumps({"kept": result["kept"], "users": result["users"],
                      "activities": len(result["activities"])}, indent=1))
