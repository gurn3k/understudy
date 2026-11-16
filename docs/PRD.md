# Understudy — PRD (v2, draft for review; v1 approved 2026-11-15)

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
3. **Three understudies audition** for the top decision point, invoice triage: should this invoice go straight to payment, or to a person?
   - **A. Rule:** a fixed rule fitted on the earlier months.
   - **B. Claude, case by case:** Claude judges each invoice from its facts.
   - **C. Claude, policy author:** Claude studies aggregate statistics from the earlier months and writes a policy in a small rule language. Code checks the policy and then runs it on every held-out invoice. Claude never sees a held-out case.
   Each is scored on precision, coverage, cost per 1,000 invoices and seconds per 1,000 invoices.
4. **Where it can be trusted.** A case type is "helper-ready" only when it passes the trust rule below. Everything else stays with people.
5. **Earned autonomy, replayed.** The held-out months are replayed week by week. Each contender starts with no autonomy in any case type.
   - **Promotion:** it earns autonomy in a case type once its shadow calls pass the trust rule.
   - **Demotion:** it loses autonomy when its recent calls fall below the bar.
   - **Evidence timing:** an outcome counts only from the week the invoice actually cleared, as it would in real life.
   - **Reported per contender:** weeks to first promotion, manual touches removed, and wrong payments let through.
6. **The rubber-stamp gate, shown.** The same replay runs with promotion decided by simulated reviewer agreement instead of outcomes. Reviewers anchor on the suggestion at stated rates. The page shows how much earlier this gate promotes and how many more wrong payments it lets through. The simulation and its assumptions are labelled as such.

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
- **Trust rule** (raised from 90% to 99% on 2026-11-15, ADR 0010). A case type (item category / spend area) is helper-ready only if the lower bound of its 95% Wilson interval for straight-through precision is at least 99%. That means at least 381 calls with 0 errors, 563 with 1, or 726 with 2. Smaller types show "not enough evidence". A pass-everything reference is shown, and it fails.
- **Choosing between the understudies (fixed before any run, ADR 0012).**
  - **Shared sample:** all three judge the same stratified sample of 1,500 held-out invoices. A and C are also scored on all 54,874.
  - **Rule:** a Claude contender beats A only if it covers at least 10 points more of the sample at the 99% bar, pooled, with no case type of 100 or more sampled calls losing precision against A, and every answer is valid.
  - **Ties:** when A and a Claude contender tie, A wins. When B and C both beat A, the cheaper one per 1,000 invoices wins.
- **Cost and speed are measured, not assumed.** Tokens and wall time are logged for every call. Cost per 1,000 invoices is calculated at published API list prices on the run date.
- **Replay rules (fixed before any replay, ADR 0013).**
  - **Promotion:** the trust rule, applied to shadow calls whose outcome is known by that week.
  - **Demotion:** the Wilson upper bound of the last 200 resolved autonomous calls falls below 99%.
  - **B is not replayed** across all 54,874 invoices because of cost. The page says so, and gives B's cost at that scale instead.
- **Rubber-stamp simulation (ADR 0014).**
  - Each simulated reviewer copies the suggestion with an anchoring rate of 0.5, 0.7 or 0.9. Otherwise they judge independently and catch a true exception with probability 0.8.
  - The agreement gate promotes when the agreement lower bound is at least 99%.
  - Every figure from it carries a "simulated" label and its parameters.
  - A fixed random seed makes the figures reproducible.
- **Expected false readings, checked in code:**
  - "Done by batch means done right": batch actions are never used as correct labels without their own check.
  - "High volume means a good candidate": already-automated activities can't rank as candidates.
  - "A repeat means rework": partial deliveries and invoices are separated from true repeats where the fields allow.
  - "Agreement means accuracy": no metric compares the helper with humans who saw its output.
  - "No correction yet means clean": unfinished cases are never labelled. The held-out months are chosen so outcomes are observable (ADR 0006, amendment 1).
- **Tiny sample first.** 50 sampled invoices through B and one policy from C, reported against these bars, before any full run.
- **Claude output is gated in code.** For B: the answer must match the schema and its decision must be one of the allowed values, or it counts as "leave to a person" and is logged. For C: the policy must parse, use only known fields and operators, and never reference held-out data.

## Out of scope, on purpose
- **A process-mining tool:** this is a findings report with three evaluated contenders, not a general analyser.
- **Live integration with any ERP.**
- **Measuring human-AI agreement as accuracy:** this is the design principle above.

## Existing tools
- **UiPath Process Mining** works out automation rates, ranks activities by lowest automation rate, and simulates savings from automation potential (from UiPath's documentation).
- **Celonis** offers process intelligence and digital twins.
- **BPI Challenge 2019 entries** analysed automation on this same log.
- **Understudy's difference:** contenders tested on held-out real outcomes, autonomy earned and lost over time per case type, cost at volume, and a measured comparison against an agreement-based gate. Sizing is shared ground. Detail is in `docs/RESEARCH.md`.

## What research doesn't show
- Real handling times per step. The log has timestamps, not effort, so hours are estimates and are shown as ranges.
- Whether the company's batch jobs were good. "Done by batch" is not "done right."

## Limits
- The data is from 2018 and has no free text (no invoice documents), so it can't show the model reading documents.
- The rubber-stamp section is a simulation with stated parameters, not a study of real reviewers.
- The method transfers; the numbers are this company's.

## Stack
Python standard library for parsing and analysis; a static HTML/JS page; Claude through headless Claude Code on the owner's plan, chunked and resumable. No new dependencies.
