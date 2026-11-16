# 0014. Agreement gate: a labelled simulation

## Decision
- **The question:** what if promotion depended on reviewers agreeing with the helper instead of on outcomes?
- **The simulated reviewer:** for each shadow call, the reviewer copies the suggestion with an anchoring rate α (0.5, 0.7 or 0.9). Otherwise they judge independently: they catch a true exception with probability 0.8 and wrongly flag a clean invoice with probability 0.02.
- **The agreement gate:** promotes a case type when the 95% lower bound of the agreement rate is at least 99%. It uses the same weeks and the same contender calls as the outcome gate.
- **Reported:** the week of first promotion, and wrong payments let through, against the outcome gate.
- **Reproducibility:** seed 20261115, with 20 repetitions per α, reported as median and range.
- **Labelling:** every figure is labelled "simulated", with its parameters beside it.

## Alternatives
Leave it as advice on the page; claim real-world anchoring rates.

## Why
It turns the build's central idea into a measured comparison. The parameters are stated, not claimed as facts about real reviewers.

## Consequences
It shows how the mechanism behaves, not how often it happens in practice.

## Amendment 1 (2026-11-15, before any replay ran)
- **Demotion:** the agreement gate demotes on outcomes, the same rule as the outcome gate, so the comparison isolates the promotion signal.
- **When evidence counts:** agreement is known in the week of the review; outcomes are known in the week of clearing.
- **Calls a reviewer sees:** the contender's straight-through calls only. Calls to leave an invoice to a person aren't reviewed for promotion.
