# 0010. Trust bar raised from 90% to 99%; model comparison on a shared sample

## What happened
- ADR 0005 set the trust bar at a 90% lower bound on precision.
- Ranking the candidates on 2026-11-15 showed the chosen decision, invoice triage, has a high base rate: 95.5% of invoices in the fitting months go straight through, and 96.9% of held-out ones.
- At 90%, "pass every invoice" would be helper-ready in every case type. The bar would measure the base rate, not the helper.
- This miss is kept on the record. No helper had been run when the bar was replaced.

## Decision
- **Trust bar:** a case type is helper-ready only if the 95% Wilson lower bound on precision of its straight-through calls is at least **99%**, about one wrongly passed invoice per 100. That needs 381 calls with 0 errors, 563 with 1, 726 with 2, or 878 with 3.
- **Pass-everything reference:** shown on the page. Its fitting-month lower bound is 95.4%, so it fails the bar.
- **Case type:** item category / spend area.
- **Model rule:** ADR 0005's rule now applies on one stratified random sample of 1,500 held-out invoices, which both helpers judge.
  - The test is pooled coverage at the bar: the share of the sample a helper passes straight through while its pooled lower bound stays at least 99%.
  - Claude must cover at least 10 percentage points more than the baseline.
  - No case type with 100 or more sampled calls may have lower precision than the baseline.
  - Every answer must be valid JSON.
  - Ties go to the baseline.
- **Baseline on the full set:** it's also scored on all 54,874 held-out invoices, for the per-type trust table.

## Alternatives
- Keep 90%, which is meaningless here.
- A bar relative to the base rate, which is harder to explain.
- Run Claude on all 54,874 invoices, which is far beyond the usage budget.

## Why
A bar a do-nothing rule passes can't tell anyone where a helper is safe.

## Consequences
Fewer case types can pass, and some will show "not enough evidence". The model comparison is pooled because the sample is too small for most types.
