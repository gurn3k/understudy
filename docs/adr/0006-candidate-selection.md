# 0006. How the top candidate is chosen

## Decision
- **Who qualifies:** manual activities, by named users, that have a target the log can answer: what a person did next, or the value they set.
- **Ranking:** by manual events per year × rule-likeness. Both are measured on the earlier months only.
- **Exclusions:** an activity that is already mostly batch (over 80% batch events) can't be a candidate.
- **The held-out set:** cases created in the later months, locked to a file with a checksum before any helper runs.
- **The time split:** chosen from the data's actual date range once the data checks are done (default: the last 3 months held out). It's recorded here as an amendment before anything is fitted.

## Alternatives
Pick the candidate by judgement; rank by volume only.

## Why
Volume alone favours work that's already automated. Rule-likeness alone favours rare work.

## Consequences
The chosen candidate could be unglamorous. That's acceptable, because the method is what's being shown.

## Amendment 1 (2026-11-15, before anything was fitted)
**The time split.** By the month the item was created:
- earlier months, for fitting: Jan–May 2018
- held out: Jun–Aug 2018
- left out of the eval: cases created from Sep 2018 onwards

The reason is censoring. The log ends in January 2019. The share of cases that reach Clear Invoice is 84–88% for items created Jan–Aug 2018, then falls to 72% (Sep), 52% (Oct), 28% (Nov) and 5% (Dec). Late cases look clean only because they haven't finished. Holding out the last three months would have graded the helper on unfinished cases. This is added to the expected false readings: "a case with no correction yet is a clean case."

**Candidates are decision points, not raw activities.** Each one has a decision a person makes, an outcome the log records, and a manual-event volume:
1. **Invoice triage at the first invoice receipt:** let the invoice go straight to clearing, or route it to a person. The volume is the manual Clear Invoice and Remove Payment Block events.
2. **Price-change risk at item creation.** The volume is manual Change Price events.
3. **Quantity-change risk at item creation.** The volume is manual Change Quantity events.

**Rule-likeness** is the balanced accuracy, on the held-out months, of the best single-field lookup rule fitted on the earlier months. Balanced accuracy is the mean of the true-positive and true-negative rates, so 0.5 means no signal. The ranking is manual events × (2 × rule-likeness − 1).
