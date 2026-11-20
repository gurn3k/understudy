# 0025. The pilot request's controls: promotion, switch-off, blind checks, intervals, data and roles

## Status
Accepted 2026-11-20, after an outside review of the pilot request (`site/rfp.html`, ADR 0020). Every result was already known. This changes what the model request asks of a proposer. It changes no study result and not the verdict (ADR 0016).

## Why
The review found that the request made a promotion gate mandatory that isn't valid when it is checked every week, left the switch-off test loosely defined, relied on outcomes after promotion that are weaker and later than the ones used to promote, assumed independent invoices, scored mandatory requirements instead of making them pass/fail, had no data-protection requirements, broke its own segregation of duties in the responsibilities table, and gave no success test for the last gate.

## Decision
1. **Promotion (M2).** A kind is promoted only on outcomes, by a rule that stays valid under repeated looks: a named sequential method, or the default of a worst likely case, allowing for orders, of at least 99.3% at three weekly looks in a row. The request shows why: the replay's gate looked 330 times (10 kinds × 33 weeks), and both promotions came the first time a bound crossed 99%. That was an early pass by chance (week 13 of the replay, ISO week 35) and a borderline kind passing on its best week (week 24 of the replay, ISO week 46). The 99.3% margin and the three looks are my defaults, not tested values.
2. **After promotion (M3).** The rate on lines paid alone must stay inside the practice-mode interval it was promoted on. Otherwise the kind is switched off.
3. **Per-order cap (M12).** Autonomy pays at most 3 lines of one purchase order (my default; the issuer sets it) before a person sees one. It is labelled as a lesson from the replay (8 of its 15 mistakes were on one order), not a tested control.
4. **The switch-off test (M3) in full.** It uses a two-sided 95% Wilson interval on the last 200 settled calls paid on its own, in arrival order. The kind is switched off when the upper end falls below 99%. In plain words, it tolerates 4 wrong in 200 (2%) and fires at the 5th. On 200 calls it catches a true 2% rate only about 37% of the time. "Settled" means cleared for payment, with 30 days passed (my default; set at Gate 1) and any correction in that time counted. The correction budget set at Gate 1 is binding: going over it switches every kind off until the sponsor decides. The request cites the replay's episode: promoted in ISO week 35 on 896 of 899, and switched off in ISO week 43 at 192 of 200.
5. **Blind checks are mandatory (D2 → M9).** They are the like-for-like outcome source once nobody checks before payment. The sample is 1,050 lines a kind a window, sized to catch a true 2% error rate (84%; 400 lines would catch it 55% of the time). Samples are drawn as whole purchase orders, and both outcome streams are logged. **The window is monthly.** It is aligned with the monthly outcome review in the responsibilities table, so a kind running at twice the allowed rate is found within a month, not a quarter. The cost model's blind-check line, total, run cost, need, return and payback were already computed on monthly windows, so the figures don't move; only their label changes from my assumption to a requirement. Drawn by order, the lines aren't independent, so the stated power holds only if the window is enlarged by the kind's own design effect. The request says so.
6. **Intervals allow for orders (M10).** Every interval is cluster-robust at purchase-order level, with the method stated. Worked example: with no mistakes, 381 independent calls prove 99%. At the study's design effect (3.56), that is about 1,357 lines (about 1,400). For a policy built on a list of suppliers, the bound is also given with suppliers as the units. The rulebook's paid lines have a supplier-level design effect of about 11 across 143 suppliers. The post-hoc whitelist (ADR 0024) holds at 99.52% with suppliers as units, resting on 13. Computed in `tools/evidence.py` (`vendor_clustering`).
7. **A whitelist to beat (M11).** A proposal must pay more lines than a supplier whitelist built by the same selection rule on the issuer's own earlier months, at a worst likely case, allowing for orders, of at least 99%.
8. **Mandatory means pass/fail.** Failing any M requirement disqualifies a proposal. The M requirements carry no points. Only proposals that meet all of them are scored, on the D items and the other criteria.
9. **Data protection (M13).** A table of mandatory items: retention and training use, residency, sub-processors, breach notice, independent attestations, and a signed data-processing agreement. R9 is re-rated from Low to Medium likelihood, because a live pilot would send supplier and invoice data to an outside model and the study sent none.
10. **Responsibilities.**
    - The Finance Controller is accountable for promotions, for confirming or overriding an automatic switch-off, and for the monthly review.
    - The Pilot Owner is consulted on rulebook sign-off, not accountable for it.
    - A row is added for writing or regenerating the rulebook, done by IT and Data, not by the person who signs it.
    - An accounts-payable team lead is consulted.
11. **Success at Gate 4.**
    - One kind is still on at the end of Phase 2.
    - The pilot stayed within the budget.
    - The measured late-fix cost is below the recalculated break-even.
    - The earned share is above the share needed to repay the pilot.
    - The default budget is in count and value. The count is at most 1 in 100 of the lines paid alone since Phase 2 began, which is the bar itself. The value cap is set by Finance at Gate 1. By its end, the replay would have exceeded the count budget (15 of 844).
12. **Wording.** "Wrong-payment budget" becomes "correction budget", and "Trigger a switch-off" becomes "Confirm or override an automatic switch-off".

All study figures on the page come from `site/data.json` (keys `controls`, `evidence.rulebook_by_vendor` and `evidence.vendor.rows[].by_vendor`), written by `tools/build_site.py`. The figures above are copied from it for the record.

## Consequences
The request asks more of a proposer, and a supplier that can't meet a data-protection item or beat a whitelist is out before scoring. The defaults in items 1, 3 and 4 are mine and are labelled on the page. The claims check (`tools/check_claims.mjs`) requires the new figures on the request and bans the old wording.
