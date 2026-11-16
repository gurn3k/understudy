# 0012. The three contenders and how one is chosen (fixed before any run)

## Decision
- **A. Rule.**
  - The case type is item category / spend area. A cell is the case type × corrections before invoice (any or none) × goods received before invoice (yes or no).
  - A passes an invoice straight through only if its cell, in the earlier months, has at least 381 invoices and a 95% Wilson lower bound of at least 99% on its straight-through rate. Everything else goes to a person.
- **Pass-everything reference:** shown for scale. It isn't a contender.
- **B. Claude, case by case.**
  - Each sampled invoice's facts are known at the decision point, together with the earlier-month rates for its cell and vendor.
  - B answers `{"decision": "straight_through" | "leave_to_person", "reason": "..."}`. Invoices go in batches of 25 per call.
  - An answer that is invalid or missing counts as "leave to a person" and is logged.
- **C. Claude, policy author.**
  - C is given only aggregate tables from the earlier months: counts and rates by cell, by vendor (vendors with 50 or more invoices) and by single field.
  - It writes a policy in a small JSON rule language:
    - rules with conditions on known fields
    - operators `eq`, `ne`, `in`, `ge`, `le`
    - `then: straight_through`
    - a default of `leave_to_person`
  - Code checks the policy, then runs it.
  - Three policies are written independently. The one with the highest earlier-month coverage that has a lower bound of at least 99% is used. All three are reported.
- **The sample:** 1,500 held-out invoices, stratified in proportion to case type, with seed 20261115. All three contenders judge it.
- **Choosing:**
  - A Claude contender beats A only if:
    1. it covers at least 10 percentage points more of the sample straight through while its pooled lower bound stays at least 99%
    2. no case type with 100 or more sampled calls has lower precision than A
    3. all its output passed the code checks
  - Ties go to A. If both B and C beat A, the lower cost per 1,000 invoices wins.
- **Full held-out:** A and C are also scored on all 54,874 held-out invoices for the per-type trust table.

## Alternatives
Use a trained model as the baseline (that needs a new dependency); let C see the held-out data (a leak).

## Why
A fixed rule is the honest thing to beat. C tests whether a model's value at scale is writing cheap, auditable policy rather than making every call itself.

## Consequences
B's result rests on a sample of 1,500. C's policy is only as good as the aggregates it was given.

Note: ADR 0015 replaces this ADR's rule for comparing the contenders on the shared sample.

## Amendment 1 (2026-11-16, after all runs; a limit, not a rule change)
"Earlier months" means order lines created January to May 2018, whatever the date of their outcome. 51,882 of 97,602 earlier-month outcomes (53%) landed on or after 2018-06-04, when the first held-out invoice arrived. A, B and C therefore used rates a live system would not yet have had, and the replay's early weeks rely on them. No held-out outcome leaked. The results are not recomputed, because changing the fitting data after results are known is the forking path ADR 0015 guards against. The page states this as a limit.
