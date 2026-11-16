# Tickets

Status is written only after a ticket's check has passed. "Done" means `python -m unittest` passes on a clean checkout, plus the ticket's own check.

| # | Ticket | Due | Status |
|---|---|---|---|
| 1 | Fixtures and answer key | Nov 15 | done |
| 2 | Streaming parser and data checks | Nov 16 AM | done |
| 3 | Manual-work analysis and independent recount | Nov 16 | done |
| 4 | Candidate ranking, target, locked held-out set | Nov 16 18:00 (pivot point) | done |
| 5 | Contender A, pass-everything reference, eval and trust table | Nov 16 AM | open |
| 6 | Contender B (Claude per case): stub, replay, 50-case sample, 1,500 run | Nov 16 PM | open |
| 7 | Contender C (Claude policy author): rule language, checks, 3 policies, full scoring | Nov 16 PM | open |
| 8 | Earned-autonomy replay (A, C) and agreement-gate simulation | Nov 17 AM | open |
| 9 | Design: product brief, mockups for a direction round, design notes | Nov 16 AM (mockups) | open |
| 10 | Findings page, generated from data | Nov 17 | open |
| 11 | Visual route and browser checks | Nov 17 | open |
| 12 | Checks: hostile input, security, independent review, audit | Nov 18 AM | open |
| 13 | README, packaging, deploy (with approval) | Nov 18 15:00 | open |

**Owner's look:** mockups Nov 16 morning (direction round); first usable page Nov 17 by 12:00.

**Cut line:** if the build is behind at Nov 17 12:00, the agreement-gate simulation (part of 8) is dropped and the page says so.

The briefs below for 5 to 10 were written for the earlier two-helper plan and are replaced by docs/PRD.md v2 and ADRs 0011 to 0014. Each new ticket's acceptance is its bar in the PRD, plus a deliberate break that makes its check fail.

---

### 1. Fixtures and answer key
- **Read:** `docs/PRD.md` (Definitions, bars), the XES header of the real log.
- **Build:** `tests/fixtures/planted.xes` and `tests/fixtures/clean.xes`, small hand-made logs in the real schema, with `tests/fixtures/answer_key.json` beside them.
- **Planted problems:**
  - an event dated before its case's creation
  - an event outside the stated range
  - a duplicate event
  - a case with no creation event
  - a resource that's neither batch nor named
  - XML escapes in fields (`&amp;`)
  - a partial invoice that looks like a repeat
  - a case where the batch user did the wrong thing
- **Acceptance:** the key gives exact expected counts for every published figure on both files. The clean file has zero data-check exclusions.
- **Out of bounds:** no parser code.
- **Next needs:** the key's field names, which become the analysis output schema.

### 2. Streaming parser and data checks
- **Read:** ticket 1's fixtures and key.
- **Build:** `understudy/parse.py`, which uses `xml.etree.iterparse` and constant memory. It reads XES into `events.jsonl` and `cases.jsonl` in `%LOCALAPPDATA%\understudy\data\`, plus `checks.json` (exclusions by reason, each with case IDs).
- **Acceptance:**
  - Fixture counts match the key exactly.
  - The full log parses in its own terminal window. Its event and case totals are reported against the source's stated counts.
- **Out of bounds:** no analysis.
- **Next needs:** documented field names, and the run's wall time and peak memory for the "at scale" section.

### 3. Manual-work analysis and independent recount
- **Build:**
  - `understudy/analyse.py`: for each activity, the manual, batch and unclassified shares, case counts, and repeat rate. Every figure carries its case-ID list.
  - `tools/recount.py`: written separately, without importing `analyse.py`.
- **Acceptance:** the recount matches every figure on both the fixtures and the full log. Breaking one figure on purpose makes the recount fail.
- **Out of bounds:** no candidate scoring.

### 4. Candidate ranking, target, locked held-out set
- **Read:** ADR 0006.
- **Build:**
  - fix the time split, and record it as an amendment to ADR 0006 before anything is fitted
  - rule-likeness per candidate
  - value ranges
  - the chosen candidate and its target
  - `heldout.jsonl` with a SHA-256 checksum recorded
- **Acceptance:** an already-automated activity can't rank (test it). The checksum is verified before every eval.
- **Pivot point:** if no candidate has a target the log can answer by Nov 16 18:00, stop. Report to the owner and ship the fallback (sizing plus the rollout design).

### 5. Rules baseline and eval
- **Build:**
  - `understudy/baseline.py`, a lookup rule fitted on earlier months
  - `understudy/evaluate.py`, with per-case-type precision, recall and coverage as count/count, plus Wilson bounds and the ADR 0005 trust verdict
- **Acceptance:**
  - Hand-worked Wilson values match.
  - A planted always-wrong helper fails the trust rule. A helper that leaves everything to a person gets zero coverage, not 100% precision.

### 6. Claude helper
- **Read:** ADR 0002 and ADR 0005.
- **Build:** `understudy/helper.py` with `stub`, `replay` and `live` modes.
  - **Live mode** calls headless Claude Code. It passes finished facts only, uses a strict JSON schema, and offers `leave_to_person`.
  - **Resumable:** a rerun fills only the missing case IDs. An empty reply stops the run cleanly.
  - **Logging:** each call records latency, tokens if reported, and its outcome, for the "at scale" section.
- **Acceptance:** stub and replay pass the eval pipeline end to end before the first live call.
- **Runs, in order:**
  1. The 50-case sample, reported against the bars, pass/fail with numbers.
  2. The full held-out run, in chunks, checking usage between chunks. It stops at 95%.
- Long runs happen in their own terminal window.

### 7. Report page
- **Build:** `site/index.html` plus `site/data.json`, generated by `tools/build_site.py`. The page has:
  - where the manual work is
  - the candidates
  - the helper result, with the model-rule verdict
  - the trust table
  - the rollout design
  - limits
  - attribution (CC BY)
  - share metadata
  - a feedback link
- **Acceptance:**
  - Every figure opens its case list.
  - The build fails on any hand-typed number in the HTML.
  - Figures carry the run date.
- **Out of bounds:** no framework, no analytics.

### 8. Visual route and browser checks
- **Build:** `tools/shoot.mjs`, which drives headless Chrome over its DevTools protocol (no dependency). It takes screenshots at 320, 390, 768 and 1280 px, in light and dark, with a wide-font pass.
- **Browser checks:**
  - figure → case list opens
  - no element overflows its container
- **Acceptance:** breaking the drill-down on purpose makes the check fail.

### 9. Checks
- **Hostile-input pass:**
  - a damaged `data.json`
  - markup in vendor names
  - a huge case list
  - an empty case type
  - a corrupted held-out file
  - a model reply with injected instructions
- **Then:**
  - **security review:** no secrets, no unsafe HTML rendering, and the served-file allowlist
  - **independent review of the diff:** done by a fresh reviewer
  - **audit:** copy through the humanizer rules, accessibility, the term scan, attribution
- Every fix gets a test, shown failing first.

### 10. Ship
- **README:** what it does, the guarantee, the live link, a screenshot, how it was built, how you know it's right, limits, how to run it.
- **Packaging:** MIT for code, the data under its own licence, the CI badge.
- **GitHub repo and CI:** need the owner's approval.
- **Deploy:** needs the owner's approval, with the full checks list shown. Deploy from a staging folder, then confirm that non-served paths return 404.
