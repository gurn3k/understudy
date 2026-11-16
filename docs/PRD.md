# Understudy — PRD (draft for review)

## Problem
Enterprises are told to "put AI into their processes", but they rarely pick where on evidence. Process-mining tools show where work is slow and how much is already automated. They stop before the question a technology leader is actually asked: *which manual step should an AI take on, how well would it do on our real cases, and how do we roll it out without people rubber-stamping it?*

## User
A technology or transformation lead choosing the first AI use case in an operational process (purchase-to-pay, order exceptions, returns, credits).

## Data
BPI Challenge 2019 (van Dongen, 4TU.ResearchData, CC BY 4.0, DOI 10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1). It's real purchase-to-pay events from a multinational coatings company. Each event records its activity, its time, and whether a batch job or a named person did it.

## Guarantee
Every size and every accuracy figure on the page opens the real cases behind it.

## What it does
1. **Where the manual work is.** For each activity it shows the share done by people and the share done by batch jobs, case counts, and repeat rates (such as price changes done more than once on an item).
2. **Candidates.** Each manual step is scored on volume, how rule-like it is (how well the case's own fields predict the outcome), and how much it's worth automating. That last score is a range, not a single number.
3. **The helper.** For the top candidate, two helpers make the same prediction: a plain rules baseline and a Claude-based helper. Both are tested on held-out later cases against what people actually did.
4. **Where it can be trusted.** A case type counts as "helper-ready" only when it passes the trust rule below. Everything else stays with people.
5. **Rollout design.** Reviewers anchor on AI suggestions, so human agreement with the helper is never used as proof it works. The page sets out blind spot-checks, override-rate tracking, and how a case type gets promoted or demoted.

## Definitions
- **Case:** one purchase order line item, the unit the log uses.
- **Manual event:** an event whose resource is a named user, not `batch_*` or `NONE`. Resources that are neither stay unclassified, and they're counted and shown.
- **Repeat rate:** among cases with an activity, the share where it happens two or more times. It's published only for change and payment-block activities. Goods receipts and invoices often repeat for partial deliveries, so they're shown as "multiple expected", not as rework.
- **Rule-likeness:** accuracy on later held-out months of the best single-field lookup rule built on earlier months. The fields are item category, document type, spend area, vendor and company, and the rule predicts the action people took.
- **Value range:** manual events per year × minutes per event (low 2, base 5, high 10). The minutes are stated assumptions shown on the page, not measured.

## Measurement bars (each a test that can fail)
- **Data check before counting.** Events dated outside 2017-01-01 to 2019-12-31, and cases with no creation event are counted, shown and excluded. Same-minute identical events (same case, activity, minute, user and value) are collapsed to one and reported by activity (ADR 0008). No published figure includes them. Events dated before their item's creation are kept and flagged, not excluded, because invoices before orders happen in real purchasing (amended 2026-11-15, ADR 0007).
- **Recount.** A separate recount script reproduces every published count exactly. A typed number on the page fails the build.
- **Held-out split.** Split by time. Rules and prompts are built only on cases created in earlier months, and tested only on later months. The test set is locked before the first helper run.
- **Metrics.** Precision, recall and coverage per case type, each shown as a count over a count.
- **Error trade-off.** Precision comes first. A wrong automated action costs more than a case left with a person, so the helper may answer "leave to a person".
- **Trust rule.** A case type is helper-ready only if the lower bound of its 95% Wilson interval for precision is at least 90%. That means at least 35 held-out cases with 0 errors, 53 with 1, 69 with 2, or 84 with 3. Case types with fewer cases are shown as "not enough evidence", never as passing.
- **Claude vs baseline (rule fixed before any run).** The Claude helper ships only if:
  1. it makes more case types helper-ready than the baseline, or covers at least 10 percentage points more held-out cases at the trust bar,
  2. no case type's precision drops below the baseline's, and
  3. its answers are valid JSON in every case, with "leave to a person" allowed.
  Ties go to the baseline (cheaper, explainable). If the baseline wins, the page says so.
- **Expected false readings, checked in code:**
  - "Done by batch means done right": batch actions are never used as correct labels without their own check.
  - "High volume means a good candidate": already-automated activities can't rank as candidates.
  - "A repeat means rework": partial deliveries and invoices are separated from true repeats where the fields allow.
  - "Agreement means accuracy": no metric compares the helper with humans who saw its output.
- **Tiny sample first.** 50 held-out cases against these bars, with pass/fail and numbers reported, before the full eval.

## Out of scope, on purpose
- **A process-mining tool:** this is a decision report with one evaluated helper, not a general analyser.
- **Live integration with any ERP.**
- **Measuring human-AI agreement as accuracy:** this is the design principle above.

## Existing tools
- **UiPath Process Mining** works out automation rates, ranks activities by lowest automation rate, and simulates savings from automation potential (from UiPath's documentation).
- **Celonis** offers process intelligence and digital twins.
- **BPI Challenge 2019 entries** analysed automation on this same log.
- **Understudy's difference:** a helper tested on held-out real outcomes, a trust rule per case type, and a rollout design that doesn't rely on human agreement. Sizing is shared ground. Detail is in `docs/RESEARCH.md`.

## What research doesn't show
- Real handling times per step. The log has timestamps, not effort, so hours are estimates and are shown as ranges.
- Whether the company's batch jobs were good. "Done by batch" is not "done right."

## Stack
Python standard library for parsing and analysis; a static HTML/JS page; Claude through headless Claude Code on the owner's plan, chunked and resumable. No new dependencies.
