"""A later check on September 2018 (docs/adr/0029-september-confirmation-check.md): pre-registered, run once.

Nothing here changes policy 2 or the supplier shortlist. Both are used exactly as they stand: policy 2 from its saved
reply, the shortlist refitted the same way as tools/evidence.py (January to May 2018 lines, the same key, cells whose
learning-month Wilson lower bound is at least 99%).

Commands (the data folder defaults to %LOCALAPPDATA%/understudy/data, or UNDERSTUDY_DATA, or the second argument):
  python tools/confirm_sept.py coverage [data]  dates only: events per day, the log's effective end, the window N
  python tools/confirm_sept.py baseline [data]  June to August: reproduce 26,715 paid / 249 wrong with no window, then
                                                re-score every approach under the window (writes confirm_baseline.json)
  python tools/confirm_sept.py lock [data]      select September's lines by first-receipt month (dates only), write the
                                                list to the data folder and the checksums to docs/confirm/sept-2018.lock
  python tools/confirm_sept.py run [data]       score September (writes confirm_sept_result.json). Refuses unless the lock
                                                exists, every checksum in it matches, and June to August reproduces first.
Standard library only.
"""
import hashlib
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))
import evidence as E  # noqa: E402
from understudy import contender_c as C  # noqa: E402
from understudy.evaluate import case_type, wilson  # noqa: E402
from understudy.files import verify  # noqa: E402
from understudy.triage import CASE_FIELDS, CLR, CREATE, GR, IR, is_corrective  # noqa: E402

MONTH = "2018-09"                # September's lines: first invoice receipt in this UTC month
WINDOW_DAYS = 109                # N, from `coverage` (ADR 0029): every September line can see N days before the log ends
FULL_DAY_EVENTS = 100            # a day with at least this many events counts as a day the log still covers
BAR = 0.99
CHOSEN_POLICY = 2
SHORTLIST_KEY = "supplier, earlier corrections, goods received first"
BASELINE = {"rulebook": (26715, 249), "shortlist": (7532, 23)}   # June to August, no window (site/data.json)
APPROACHES = ("rulebook", "shortlist", "pass_everything")
TESTED = ("rulebook", "shortlist")                                # pass-everything is context only
LIST_NAME = "sept_2018_lines.txt"
LOCK = ROOT / "docs" / "confirm" / "sept-2018.lock"
# Repo files whose bytes the run depends on. Hashed with line endings normalised to \n, so a Windows checkout
# (core.autocrlf) hashes the same as the committed blob.
LOCKED_CODE = ("tools/confirm_sept.py", "tools/evidence.py", "understudy/contender_c.py", "understudy/evaluate.py",
               "understudy/triage.py", "understudy/files.py")
LOCKED_DATA = ("responses/c/c_policy_2.json", "invoice_triage_fit.jsonl", "invoice_triage_heldout.jsonl")

# What each result changes (ADR 0029, from Gurnek's decisions 5 and 6). The headline stays "not proven" whatever happens.
PASS_LINE = ("On September 2018, a later month nobody had looked at, the rulebook cleared the bar. One month isn't "
             "enough to reverse the main test; the pilot is how to find out.")
WORSE_NOTE = "Soften the rulebook's evidence lines and its reference-design role."
REFIT_REQ = ("Beat the same shortlist rule, refitted on the issuer's own recent data in Phase 0.")
HELD_NOTE = "held up on a later month"


def data_dir(argv):
    if len(argv) > 2:
        return Path(argv[2])
    return Path(os.environ.get("UNDERSTUDY_DATA") or Path(os.environ.get("LOCALAPPDATA", "")) / "understudy" / "data")


def iter_jsonl(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def ts(s):
    return datetime.fromisoformat(s)


# ---- Dates only -------------------------------------------------------------------------------------------------

def first_ir(evs):
    return next((i for i, e in enumerate(evs) if e["act"] == IR), None)


def receipt_month(case):
    """The UTC month of the line's first invoice receipt, or None. Reads only the receipt's date."""
    i = first_ir(case["events"])
    return None if i is None else case["events"][i]["ts"][:7]


def creation_month(case):
    return min(e["ts"] for e in case["events"] if e["act"] == CREATE)[:7]


def effective_end(day_counts, full=FULL_DAY_EVENTS):
    """Midnight (UTC) after the last day with at least `full` events: the log's effective end."""
    last = max(d for d, n in day_counts.items() if n >= full)
    return datetime.fromisoformat(last).replace(tzinfo=timezone.utc) + timedelta(days=1)


def window_for(month, end):
    """Whole days every line with a first receipt in `month` can observe before `end` (from the month's last instant)."""
    y, m = map(int, month.split("-"))
    after = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc)
    return (end - after).days


def coverage(cases):
    days, months = Counter(), Counter()
    for c in cases:
        for e in c["events"]:
            days[e["ts"][:10]] += 1
            months[e["ts"][:7]] += 1
    end = effective_end(days)
    after = {d: n for d, n in days.items() if d >= end.date().isoformat()}
    return {"effective_end": end.isoformat(), "last_full_day": (end - timedelta(days=1)).date().isoformat(),
            "full_day_events": FULL_DAY_EVENTS, "events_after_end": sum(after.values()), "days_after_end": sorted(after.items()),
            "window_days": window_for(MONTH, end), "events_by_month": dict(sorted(months.items()))}


def select(cases, month=MONTH):
    """September's lines, by first-receipt month: (sorted ids, ids per creation month). Dates only."""
    ids, by_create = [], Counter()
    for c in cases:
        if receipt_month(c) == month:
            ids.append(c["id"])
            by_create[creation_month(c)] += 1
    return sorted(ids), dict(sorted(by_create.items()))


# ---- The record and the outcome ---------------------------------------------------------------------------------

def features(case):
    """What was known at the first invoice receipt: the same fields as triage.triage_record, with no month filter
    and no need for a clearing (so lines that never cleared get a record too)."""
    evs = case["events"]
    created = min(e["ts"] for e in evs if e["act"] == CREATE)
    fi = first_ir(evs)
    inv, before = evs[fi], evs[:fi]
    rec = {f: case.get(f) for f in CASE_FIELDS}
    rec.update({"id": case["id"], "invoice_value": inv["worth"],
                "gr_before_invoice": any(e["act"] == GR for e in before),
                "corrections_before_invoice": sum(1 for e in before if is_corrective(e["act"])),
                "invoice_before_creation": inv["ts"] < created})
    return rec


def outcome(case, days):
    """'wrong', 'fine' or 'stuck' for a line, looking only `days` days past its first receipt (None: no limit).

    - wrong: a correction after the first receipt and before the first clearing after it, within the window. This
      also covers a line that never cleared but showed a correction first ("a correction before it got stuck").
    - fine:  that clearing came within the window, with no correction before it.
    - stuck: no clearing within the window and no correction in it.
    With no limit this is the study's label (triage.py): straight_through == (outcome == 'fine') on every cleared line.
    """
    evs = case["events"]
    fi = first_ir(evs)
    cl = next((i for i in range(fi + 1, len(evs)) if evs[i]["act"] == CLR), None)
    limit = None if days is None else ts(evs[fi]["ts"]) + timedelta(days=days)

    def seen(e):
        return limit is None or ts(e["ts"]) <= limit

    if any(is_corrective(e["act"]) and seen(e) for e in evs[fi + 1:len(evs) if cl is None else cl]):
        return "wrong"
    return "fine" if cl is not None and seen(evs[cl]) else "stuck"


# ---- The approaches (frozen) ------------------------------------------------------------------------------------

def shortlist_cells(fit):
    """The cells of the picked key whose learning-month Wilson lower bound is at least 99% (evidence.vendor_panel)."""
    kf, st = E.VENDOR_KEYS[SHORTLIST_KEY], defaultdict(lambda: [0, 0])
    for r in fit:
        s = st[kf(r)]
        s[1] += 1
        s[0] += r["straight_through"]
    return {c for c, (a, b) in st.items() if (wilson(a, b)[0] or 0) >= BAR}


def deciders(policy_reply, fit):
    kf, cells = E.VENDOR_KEYS[SHORTLIST_KEY], shortlist_cells(fit)
    return {"rulebook": C.decider(policy_reply), "shortlist": lambda r: kf(r) in cells,
            "pass_everything": lambda _r: True}


# ---- Scoring ----------------------------------------------------------------------------------------------------

def interval(ids, wrong):
    """Share fine with the study's purchase-order intervals: the whole-order bootstrap (evidence.po_bootstrap, fixed
    seed; the interval the tests use) and, alongside, Wilson on the design-effect sample size."""
    if not ids:
        return None
    cl = E.clusters(sorted(ids), wrong)
    n, w = len(ids), len(wrong)
    ne = n / E.design_effect(cl)
    return {"n": n, "wrong": w, "orders": len(cl), "fine_share": 1 - w / n, "error_rate": w / n,
            "boot": list(E.po_bootstrap(cl)), "deff": E.design_effect(cl), "deff_wilson": list(wilson((1 - w / n) * ne, ne))}


def block(rows, boot=True):
    """rows: [(record, status)] for the lines an approach paid. Main figure leaves stuck lines out; worst case counts
    them as wrong; stuck share = stuck / paid."""
    ids = [r["id"] for r, _ in rows]
    stuck = {r["id"] for r, s in rows if s == "stuck"}
    wrong = {r["id"] for r, s in rows if s == "wrong"}
    out = {"paid": len(ids), "wrong": len(wrong), "stuck": len(stuck), "fine": len(ids) - len(wrong) - len(stuck),
           "stuck_share": len(stuck) / len(ids) if ids else None}
    if boot:
        out["main"] = interval([i for i in ids if i not in stuck], wrong)
        out["worst"] = interval(ids, wrong | stuck)
    else:
        n_main = len(ids) - len(stuck)
        out["main"] = {"n": n_main, "wrong": len(wrong), "fine_share": 1 - len(wrong) / n_main if n_main else None}
        out["worst"] = {"n": len(ids), "wrong": len(wrong) + len(stuck),
                        "fine_share": 1 - (len(wrong) + len(stuck)) / len(ids) if ids else None}
    return out


def score(lines, decide, boot=True):
    """lines: [(record, status)]. Pooled and per kind (case_type) for one approach."""
    paid = [(r, s) for r, s in lines if decide(r)]
    kinds = defaultdict(list)
    for r, s in paid:
        kinds[case_type(r)].append((r, s))
    return {"pooled": block(paid, boot), "kinds": {k: block(v, boot) for k, v in sorted(kinds.items())}}


def stuck_by_kind(lines):
    """Stuck share of every line of each kind, paid or not."""
    t = defaultdict(lambda: [0, 0])
    for r, s in lines:
        x = t[case_type(r)]
        x[0] += s == "stuck"
        x[1] += 1
    return {k: {"lines": n, "stuck": a, "stuck_share": a / n} for k, (a, n) in sorted(t.items())}


def score_all(lines, dec, boot=True):
    return {"lines": len(lines), "stuck_by_kind": stuck_by_kind(lines),
            "approaches": {a: score(lines, dec[a], boot) for a in APPROACHES}}


# ---- The two tests and the readings (decision 4) ----------------------------------------------------------------

def test_a(iv):
    """(a) The lower end of the purchase-order interval reaches 99%."""
    return iv is not None and iv["boot"][0] >= BAR


def test_b(sept, base):
    """(b) Against June to August, in error rates: held up if the two intervals overlap; did worse if September's
    interval lies wholly above June to August's error rate; did better if wholly below. None if September paid none."""
    if sept is None or base is None:
        return None
    s_lo, s_hi = 1 - sept["boot"][1], 1 - sept["boot"][0]
    b_lo, b_hi = 1 - base["boot"][1], 1 - base["boot"][0]
    if s_lo <= b_hi and b_lo <= s_hi:
        return "held up"
    if s_lo > base["error_rate"]:
        return "did worse"
    if s_hi < base["error_rate"]:
        return "did better"
    raise ValueError("June to August's error rate lies outside its own interval")


def reading(sept, base):
    """Both tests on the main figure and on the worst case. A test whose verdict differs between them is unsettled."""
    a = {c: test_a(sept[c]) for c in ("main", "worst")}
    b = {c: test_b(sept[c], base[c]) for c in ("main", "worst")}
    return {"a_main": a["main"], "a_worst": a["worst"],
            "a": ("pass" if a["main"] else "fail") if a["main"] == a["worst"] else "unsettled",
            "b_main": b["main"], "b_worst": b["worst"],
            "b": b["main"] if b["main"] == b["worst"] and b["main"] is not None else "unsettled"}


def consequences(rb, sl):
    """What each reading changes (decisions 5 and 6). The headline never changes."""
    page, rfp = [], []
    if rb["a"] == "pass":
        page.append({"add_line": PASS_LINE, "rfp_pass_marks": "unchanged"})
    if rb["b"] == "did worse":
        page.append({"soften": WORSE_NOTE})
    if sl["a"] == "fail" or sl["b"] == "did worse":
        rfp.append({"shortlist_requirement": REFIT_REQ})
    elif sl["a"] == "pass" and sl["b"] in ("held up", "did better"):
        rfp.append({"shortlist_requirement": "unchanged (99.51%)", "note": HELD_NOTE})
    else:
        rfp.append({"shortlist_requirement": "unchanged (99.51%)", "note": None, "why": "unsettled"})
    return {"headline": "unchanged (not proven)", "page": page, "rfp": rfp}


# ---- Inputs -----------------------------------------------------------------------------------------------------

def load_inputs(data):
    verify(data / "invoice_triage_heldout.jsonl", "heldout.sha256")
    reply = json.loads((data / "responses" / "c" / f"c_policy_{CHOSEN_POLICY}.json").read_text(encoding="utf-8"))["reply"]
    fit = list(iter_jsonl(data / "invoice_triage_fit.jsonl"))
    held = list(iter_jsonl(data / "invoice_triage_heldout.jsonl"))
    return reply, fit, held


def baseline_lines(data, held):
    """June to August's locked lines with their outcome with no window and under the window, checking that the
    rebuilt record matches the locked one field for field. Returns (no window, windowed), each [(record, status)]."""
    by_id, lines = {r["id"]: r for r in held}, {}
    for c in iter_jsonl(data / "cases.jsonl"):
        r = by_id.get(c["id"])
        if r is None:
            continue
        f = features(c)
        if any(f[k] != r[k] for k in f):
            raise SystemExit(f"rebuilt record differs from the locked one: {c['id']}")
        lines[c["id"]] = (outcome(c, None), outcome(c, WINDOW_DAYS))
    if len(lines) != len(held):
        raise SystemExit("some locked June to August lines are missing from cases.jsonl")
    return ([(r, lines[r["id"]][0]) for r in held], [(r, lines[r["id"]][1]) for r in held])


def reproduce(fit, held, dec, nowin):
    """No window: policy 2 pays 26,715 with 249 wrong; the shortlist pays 7,532 with 23 wrong; nothing is stuck."""
    if E.vendor_panel(fit, held)["picked"] != SHORTLIST_KEY:
        raise SystemExit("the shortlist's selection rule no longer picks the frozen key")
    for name, (paid, wrong) in BASELINE.items():
        got = [(r, s) for r, s in nowin if dec[name](r)]
        p, w = len(got), sum(s == "wrong" for _, s in got)
        if (p, w) != (paid, wrong) or any(s == "stuck" for _, s in got):
            raise SystemExit(f"{name}: no-window figures {p} paid / {w} wrong, expected {paid} / {wrong}")
        if any((s == "fine") != r["straight_through"] for r, s in got):
            raise SystemExit(f"{name}: the no-window outcome differs from the locked label")


def june_august(data):
    reply, fit, held = load_inputs(data)
    dec = deciders(reply, fit)
    nowin, windowed = baseline_lines(data, held)
    reproduce(fit, held, dec, nowin)
    return dec, nowin, windowed


# ---- Lock -------------------------------------------------------------------------------------------------------

def sha_text(path):
    return hashlib.sha256(Path(path).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def sha_bytes(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def lock_entries(data):
    out = [(sha_bytes(data / LIST_NAME), "list", LIST_NAME)]
    out += [(sha_text(ROOT / p), "repo", p) for p in LOCKED_CODE]
    out += [(sha_bytes(data / p), "data", p) for p in LOCKED_DATA]
    return out


def read_lock(path=LOCK):
    if not path.exists():
        raise SystemExit(f"refusing to score September: no lock at {path}")
    entries, meta = [], {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if not parts or line.startswith("#"):
            continue
        if len(parts) == 3 and len(parts[0]) == 64:
            entries.append(tuple(parts))
        elif len(parts) == 2:
            meta[parts[0]] = parts[1]
    return entries, meta


def check_lock(data, path=LOCK):
    entries, meta = read_lock(path)
    want = {(kind, p): h for h, kind, p in entries}
    got = {(kind, p): h for h, kind, p in lock_entries(data)}
    if set(want) != set(got):
        raise SystemExit("refusing to score September: the lock lists different files")
    bad = [f"{k}:{p}" for (k, p), h in got.items() if want[(k, p)] != h]
    if bad:
        raise SystemExit("refusing to score September: changed since the lock: " + ", ".join(bad))
    if int(meta.get("window_days", -1)) != WINDOW_DAYS or meta.get("month") != MONTH:
        raise SystemExit("refusing to score September: the window or month differs from the lock")
    return entries, meta


def write_lock(data):
    ids, by_create = select(iter_jsonl(data / "cases.jsonl"))
    (data / LIST_NAME).write_text("".join(i + "\n" for i in ids), encoding="utf-8", newline="\n")
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# September 2018 confirmation lock (docs/adr/0029-september-confirmation-check.md).",
             "# Written before any September outcome was computed. Lines: sha256, where, path.",
             "# repo files are hashed with \\r\\n read as \\n; list and data files are hashed as raw bytes."]
    lines += [f"{h}  {k}  {p}" for h, k, p in lock_entries(data)]
    lines += [f"month {MONTH}", f"window_days {WINDOW_DAYS}", f"lines {len(ids)}",
              f"created_in_month {by_create.get(MONTH, 0)}"]
    LOCK.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return len(ids), by_create


# ---- Commands ---------------------------------------------------------------------------------------------------

def baseline_figures(data):
    dec, nowin, windowed = june_august(data)
    return {"window_days": WINDOW_DAYS,
            "no_window": {a: score(nowin, dec[a], boot=False)["pooled"] for a in APPROACHES},
            "windowed": score_all(windowed, dec)}


def run(data):
    entries, meta = check_lock(data)
    dec, _nowin, windowed = june_august(data)
    base = score_all(windowed, dec)
    ids = (data / LIST_NAME).read_text(encoding="utf-8").split()
    want, lines, created = set(ids), [], {}
    for c in iter_jsonl(data / "cases.jsonl"):
        if c["id"] in want:
            if receipt_month(c) != MONTH:
                raise SystemExit(f"{c['id']} is on the locked list but was not first invoiced in {MONTH}")
            lines.append((features(c), outcome(c, WINDOW_DAYS)))
            created[c["id"]] = creation_month(c)
    if len(lines) != int(meta["lines"]) or sorted(r["id"] for r, _ in lines) != ids:
        raise SystemExit("the September lines differ from the locked list")
    sept = score_all(lines, dec)
    read = {a: reading(sept["approaches"][a]["pooled"], base["approaches"][a]["pooled"]) for a in TESTED}
    # Secondary, reported only: lines also created in September (none could sit in the learning or test months).
    new = [(r, s) for r, s in lines if created[r["id"]] == MONTH]
    new_scored = score_all(new, dec)
    return {"month": MONTH, "window_days": WINDOW_DAYS, "lock": [list(e) for e in entries],
            "june_august": base, "september": sept, "readings": read,
            "consequences": consequences(read["rulebook"], read["shortlist"]),
            "secondary_created_in_september": {"scores": new_scored, "readings": {
                a: reading(new_scored["approaches"][a]["pooled"], base["approaches"][a]["pooled"]) for a in TESTED}}}


def main(argv):
    if len(argv) < 2 or argv[1] not in ("coverage", "baseline", "lock", "run"):
        sys.exit(__doc__)
    data, cmd = data_dir(argv), argv[1]
    if cmd == "coverage":
        out = coverage(iter_jsonl(data / "cases.jsonl"))
        if out["window_days"] != WINDOW_DAYS:
            sys.exit(f"the log now supports {out['window_days']} days, not {WINDOW_DAYS}")
        path = data / "confirm_coverage.json"
    elif cmd == "baseline":
        out, path = baseline_figures(data), data / "confirm_baseline.json"
    elif cmd == "lock":
        if LOCK.exists():
            sys.exit(f"{LOCK} exists; a lock is written once")
        n, by_create = write_lock(data)
        print(json.dumps({"lines": n, "by_creation_month": by_create}, indent=1))
        print(LOCK.read_text(encoding="utf-8"))
        return
    else:
        out, path = run(data), data / "confirm_sept_result.json"
    path.write_text(json.dumps(out, indent=1, sort_keys=True), encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main(sys.argv)
