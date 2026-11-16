# 0016. The verdict (decided 2026-11-15 by an independent reviewer, applying ADRs 0012 and 0015 as written)

## Verdicts
- **Pre-registered (ADR 0012):** A wins by default. No contender reaches a 99% lower bound on the sample: C 97.5%, B 93.8%.
- **Revised (ADR 0015, written after one result was seen):** A wins by default again. The chosen policy (policy 2, unseen) has a pooled held-out lower bound of 98.945%, below 99%. Nothing is rounded up. A's win is empty: it passes 0 of 54,874 invoices.
- **B against C:** not separated. B made fewer wrong passes (B-only errors 0, C-only 9, one-sided sign test p = 0.002), but its coverage (88) is below C's (736). Cost breaks the tie: C costs about $0.40 once, B about $2.60 per 1,000 invoices. The page states that B made fewer wrong passes.
- **B against A:** not shown at the bar (5.9% coverage, lower bound 93.8%).

## Headline (exact)
"No contender earned trust at the 99% bar: the fixed rule passes nothing, and the policy Claude wrote passes 48.7% of held-out invoices at 99.07% correct, just short of the bar (lower bound 98.95%)."

## Policy 1 (only in the three-policy table and its note)
"One of the three policies (policy 1) does clear the bar on held-out invoices (lower bound 99.08%), but its result had been seen before the rule was rewritten and the earlier-month selection did not choose it, so it does not count towards the verdict; all three are shown."

## The replay
The replay (ADR 0013) is a separate pre-registered analysis that answers "which case types could be trusted". It can't overturn the pooled verdict. Nothing about it is written until it finishes.

## Why
The rules were fixed before these results, and the miss is 0.0005. Swapping in policy 1, or softening the bar, would be the cherry-pick these rules exist to prevent. Three independent policies landing between 99.07% and 99.20% is the finding: about 99.1% precision at about 48% coverage, right at the edge of the bar.
