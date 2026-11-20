# 0024. A post-hoc non-AI baseline that may use the supplier

## Status
Accepted 2026-11-20, after an outside review of the published page. Every result was already known. This is a check on the yardstick, added after the fact. It is not a contender, it doesn't change the verdict (ADR 0016), and it isn't a headline.

## Why
The simple rule fixed in advance (ADR 0012) groups invoices by kind (category and spend area) and can't look at the supplier. The review argued that this makes the non-AI baseline a straw man: a finance team's first rule would often be a supplier whitelist.

## Decision
1. **The same selection rule as the study's own.** For each grouping, a group is paid only if its learning-month record proves the bar (Wilson lower bound at least 99%). The grouping that pays the most in the learning months is picked. Four groupings are shown: supplier alone; supplier and earlier corrections; supplier, earlier corrections and goods received first; and the simple rule's grouping plus the supplier.
2. **Scored like everything else,** on the 54,874 test invoices. Each grouping shows a Wilson bound and a whole-order (PO) bootstrap, plus the number of suppliers it rests on. All figures are computed by `tools/evidence.py` into `site/data.json` (key `evidence.vendor`).
3. **Labelled on the page** as after the fact, robust to purchase-order clustering, resting on about a dozen suppliers, and to be confirmed on later data. It sits in Q3's detail fold, not in Q1 or the strip.
4. **Wording elsewhere.** The page says "none of the three pre-registered approaches" and "the best of the three tested", and calls the simple rule a per-category rule.
5. **In the pilot request,** any proposal must beat a supplier whitelist built on the issuer's own data.

## Don't claim
- That a supplier rule proves the bar in general. It rests on about a dozen suppliers.
- That the rule's result is robust at the supplier level. Only purchase-order clustering was checked.
- That it was pre-registered, or that it changes the verdict.
