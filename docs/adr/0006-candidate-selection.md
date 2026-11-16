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
