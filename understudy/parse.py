"""Stream a BPI 2019 XES log into one JSON line per case, with data checks.

Constant memory: each <trace> is read, cleaned, written and dropped.
Usage: python -m understudy.parse <log.xes> <out_dir>
"""
import json
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

CREATE = "Create Purchase Order Item"
DATE_MIN = datetime.fromisoformat("2017-01-01T00:00:00+00:00")
DATE_MAX = datetime.fromisoformat("2020-01-01T00:00:00+00:00")  # exclusive

CASE_FIELDS = {
    "concept:name": "id",
    "Item Category": "category",
    "Document Type": "doc_type",
    "Spend area text": "spend_area",
    "Sub spend area text": "sub_spend_area",
    "Spend classification text": "spend_class",
    "Company": "company",
    "Vendor": "vendor",
    "Name": "vendor_name",
    "Item Type": "item_type",
    "Goods Receipt": "gr_flag",
    "GR-Based Inv. Verif.": "gr_based_iv",
}


def to_utc(text):
    """Parse an XES timestamp to UTC. Missing or unreadable -> None.
    A timestamp with no zone is taken as UTC."""
    if not text or not isinstance(text, str):
        return None
    try:
        ts = datetime.fromisoformat(text)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return None


def resource_kind(user):
    if not isinstance(user, str):
        return "unclassified"
    if user.startswith("batch_"):
        return "batch"
    if user.startswith("user_"):
        return "manual"
    return "unclassified"


def _value(el):
    tag, v = el.tag, el.get("value")
    if tag == "boolean":
        return v == "true"
    if tag == "float":
        try:
            return float(v)
        except (TypeError, ValueError):
            return None
    return v


def iter_raw_cases(path):
    """Yield (case_attrs, [event dicts]) for each trace, in file order."""
    depth_in_trace = False
    root = None
    for ev, el in ET.iterparse(path, events=("start", "end")):
        if ev == "start":
            if root is None:
                root = el
            if el.tag == "trace":
                depth_in_trace = True
            continue
        if el.tag == "event" and depth_in_trace:
            continue  # handled when its trace ends
        if el.tag == "trace":
            attrs = {}
            for child in el:
                if child.tag != "event" and child.get("key") in CASE_FIELDS:
                    attrs[CASE_FIELDS[child.get("key")]] = _value(child)
            events = []
            for e in el.findall("event"):
                d = {child.get("key"): _value(child) for child in e}
                events.append({
                    "act": d.get("concept:name"),
                    "ts": d.get("time:timestamp"),
                    "user": d.get("User") or d.get("org:resource") or "UNKNOWN",
                    "worth": d.get("Cumulative net worth (EUR)"),
                })
            if not isinstance(attrs.get("id"), str):
                attrs["id"] = "<no id>"
            yield attrs, events
            el.clear()
            root.clear()  # drop the finished trace so memory stays flat
            depth_in_trace = False


class Checks:
    def __init__(self):
        self.raw_cases = 0
        self.raw_events = 0
        self.bad_date = {}       # case id -> count (out of window, missing or unreadable)
        self.duplicate = {}      # case id -> count
        self.no_creation = {}    # case id -> events dropped with it

    def as_dict(self):
        def block(d):
            return {"count": sum(d.values()), "cases": sorted(d)}
        nc = {"count": len(self.no_creation),
              "events": sum(self.no_creation.values()),
              "cases": sorted(self.no_creation)}
        return {"raw": {"cases": self.raw_cases, "events": self.raw_events},
                "excluded": {"bad_date_events": block(self.bad_date),
                             "duplicate_events": block(self.duplicate),
                             "no_creation_cases": nc}}


def clean_case(attrs, events, checks):
    """Apply the data checks. Returns the kept case, or None if excluded."""
    cid = attrs.get("id")
    checks.raw_cases += 1
    checks.raw_events += len(events)
    kept, seen = [], set()
    for e in events:
        ts = to_utc(e["ts"])
        if ts is None or not (DATE_MIN <= ts < DATE_MAX):
            checks.bad_date[cid] = checks.bad_date.get(cid, 0) + 1
            continue
        key = (e["act"], e["ts"], e["user"], e["worth"])
        if key in seen:
            checks.duplicate[cid] = checks.duplicate.get(cid, 0) + 1
            continue
        seen.add(key)
        kept.append(dict(e, ts=ts.isoformat(), kind=resource_kind(e["user"])))
    if not any(e["act"] == CREATE for e in kept):
        checks.no_creation[cid] = len(kept)
        return None
    kept.sort(key=lambda e: e["ts"])  # stable: same-time events keep file order
    return dict(attrs, events=kept)


def parse_log(path, out_dir=None):
    """Clean every case. Writes cases.jsonl and checks.json when out_dir is given.
    Returns (kept_cases or None, checks dict). Kept cases are returned only
    when out_dir is None (for tests on small files)."""
    checks = Checks()
    kept = [] if out_dir is None else None
    out = None
    if out_dir is not None:
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        out = open(out_dir / "cases.jsonl", "w", encoding="utf-8")
    try:
        for attrs, events in iter_raw_cases(path):
            case = clean_case(attrs, events, checks)
            if case is None:
                continue
            if out:
                out.write(json.dumps(case, ensure_ascii=False) + "\n")
            else:
                kept.append(case)
    finally:
        if out:
            out.close()
    result = checks.as_dict()
    if out_dir is not None:
        (out_dir / "checks.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    return kept, result


if __name__ == "__main__":
    t0 = time.time()
    _, res = parse_log(sys.argv[1], sys.argv[2])
    secs = round(time.time() - t0, 1)
    summary = {"raw": res["raw"],
               "excluded": {k: v["count"] for k, v in res["excluded"].items()},
               "seconds": secs}
    print(json.dumps(summary, indent=1))
