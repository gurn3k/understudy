# 0023. Checking each invoice against the rulebook: a coverage gap, not an accuracy gain

## Status
Accepted 2026-11-20, after an outside review of the published page. Every result was already known. The comparison rule (ADR 0015) and its verdict stand: the rulebook goes forward on cost. This record changes only how the page describes the comparison.

## Why
The comparison rule fixed in ADR 0015 looks at mistakes one approach made and the other avoided, and tests the gap with a sign test. On the 1,500-invoice sample, the rulebook made 9 such mistakes and checking each invoice made 0 (p = 0.002). The page read this as "Claude checking each invoice made fewer wrong payments."

That reading doesn't hold. Checking each invoice paid 88 invoices, and the rulebook also paid every one of them. On those 88, each approach paid 1 that needed fixing. The rulebook's 9 "only" mistakes are all on invoices the other approach held. So the test measures how much less one approach paid, not how much more accurate it was. When one approach's passes sit inside the other's, the rule is ill-posed: the narrower approach can't make a mistake the wider one avoided.

## Decision
1. The page says: "Paid only invoices the rulebook also paid, and was right on them about as often; it added cost, not accuracy."
2. The p-value is still shown, next to the reason it is ill-posed here: every mistake "only the rulebook made" is on an invoice the other held.
3. The counts (how many of its passes the rulebook also paid, and the rulebook's mistakes on them) are computed in `tools/build_site.py` into `site/data.json` (key `evidence.b_in_c`).
4. The verdict doesn't change: under the rule neither wins on accuracy, so cost decides.

## Don't claim
- That checking each invoice made fewer wrong payments, or was more accurate.
- That the sign test separated the two approaches.
