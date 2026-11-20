# 0025. The pilot request's controls: promotion, switch-off, blind checks, intervals, data and roles

## Status
Accepted 2026-11-20, after an outside review of the pilot request (`site/rfp.html`, ADR 0020). Every result was already known. This changes what the model request asks of a proposer. It changes no study result and not the verdict (ADR 0016).

## Why
The review found that the request made a promotion gate mandatory that isn't valid when it is checked every week, left the switch-off test loosely defined, relied on outcomes after promotion that are weaker and later than the ones used to promote, assumed independent invoices, scored mandatory requirements instead of making them pass/fail, had no data-protection requirements, broke its own segregation of duties in the responsibilities table, and gave no success test for the last gate.

## Decision
1. **Promotion (M2).** A kind is promoted only on outcomes, by a rule that stays valid under repeated looks: a named sequential method, or the default of a worst likely case, allowing for orders, of at least 99.3% at three weekly looks in a row (amended: see Amendment 1, items A1 and A8). The request shows why: the replay's gate looked 330 times (10 kinds × 33 weeks), and both promotions came the first time a bound crossed 99%. That was an early pass by chance (week 13 of the replay, ISO week 35) and a borderline kind passing on its best week (week 24 of the replay, ISO week 46). The 99.3% margin and the three looks are my defaults, not tested values.
2. **After promotion (M3; defined in Amendment 1, A3).** The rate on lines paid alone must stay inside the practice-mode interval it was promoted on. Otherwise the kind is switched off.
3. **Per-order cap (M12; release and effect in Amendment 1, A13).** Autonomy pays at most 3 lines of one purchase order (my default; the issuer sets it) before a person sees one. It is labelled as a lesson from the replay (8 of its 15 mistakes were on one order), not a tested control.
4. **The switch-off test (M3) in full.** It uses a two-sided 95% Wilson interval on the last 200 settled calls paid on its own, in arrival order. The kind is switched off when the upper end falls below 99%. In plain words, it tolerates 4 wrong in 200 (2%) and fires at the 5th. On 200 calls it catches a true 2% rate only about 37% of the time. "Settled" (amended, A6) means cleared for payment, with 30 days passed (my default; set at Gate 1) and any correction in that time counted. The correction budget set at Gate 1 is binding: going over it switches every kind off until the sponsor decides. The request cites the replay's episode: promoted in ISO week 35 on 896 of 899, and switched off in ISO week 43 at 192 of 200.
5. **Blind checks are mandatory (D2 → M9). Superseded in part by Amendment 1, A5: the window is now set in lines, and the figures do move.** They are the like-for-like outcome source once nobody checks before payment. The sample is 1,050 lines a kind a window, sized to catch a true 2% error rate (84%; 400 lines would catch it 55% of the time). Samples are drawn as whole purchase orders, and both outcome streams are logged. **The window is monthly.** It is aligned with the monthly outcome review in the responsibilities table, so a kind running at twice the allowed rate is found within a month, not a quarter. The cost model's blind-check line, total, run cost, need, return and payback were already computed on monthly windows, so the figures don't move; only their label changes from my assumption to a requirement. Drawn by order, the lines aren't independent, so the stated power holds only if the window is enlarged by the kind's own design effect. The request says so.
6. **Intervals allow for orders (M10).** Every interval is cluster-robust at purchase-order level, with the method stated. Worked example: with no mistakes, 381 independent calls prove 99%. At the study's design effect (3.56), that is about 1,357 lines (about 1,400). For a policy built on a list of suppliers, the bound is also given with suppliers as the units. The rulebook's paid lines have a supplier-level design effect of about 11 across 143 suppliers. The post-hoc whitelist (ADR 0024) holds at 99.52% with suppliers as units, resting on 13. Computed in `tools/evidence.py` (`vendor_clustering`).
7. **A whitelist to beat (M11).** A proposal must pay more lines than a supplier whitelist built by the same selection rule on the issuer's own earlier months, at a worst likely case, allowing for orders, of at least 99%.
8. **Mandatory means pass/fail.** Failing any M requirement disqualifies a proposal. The M requirements carry no points. Only proposals that meet all of them are scored, on the D items and the other criteria.
9. **Data protection (M13).** A table of mandatory items: retention and training use, residency, sub-processors, breach notice, independent attestations, and a signed data-processing agreement. R9 is re-rated from Low to Medium likelihood, because a live pilot would send supplier and invoice data to an outside model and the study sent none.
10. **Responsibilities.**
    - The Finance Controller is accountable for promotions, for confirming or overriding an automatic switch-off, and for the monthly review.
    - The Pilot Owner is consulted on rulebook sign-off, not accountable for it.
    - A row is added for writing or regenerating the rulebook, done by IT and Data, not by the person who signs it.
    - An accounts-payable team lead is consulted.
11. **Success at Gate 4 (the budget is amended, A4; the ask, A11).**
    - One kind is still on at the end of Phase 2.
    - The pilot stayed within the budget.
    - The measured late-fix cost is below the recalculated break-even.
    - The earned share is above the share needed to repay the pilot.
    - The default budget is in count and value. The count is at most 1 in 100 of the lines paid alone since Phase 2 began, which is the bar itself. The value cap is set by Finance at Gate 1. By its end, the replay would have exceeded the count budget (15 of 844).
12. **Wording.** "Wrong-payment budget" becomes "correction budget", and "Trigger a switch-off" becomes "Confirm or override an automatic switch-off".

All study figures on the page come from `site/data.json` (keys `controls`, `evidence.rulebook_by_vendor` and `evidence.vendor.rows[].by_vendor`), written by `tools/build_site.py`. The figures above are copied from it for the record.

## Consequences
The request asks more of a proposer, and a supplier that can't meet a data-protection item or beat a whitelist is out before scoring. The defaults in items 1, 3 and 4 are mine and are labelled on the page. The claims check (`tools/check_claims.mjs`) requires the new figures on the request and bans the old wording.

## Amendment 1 (2026-11-20, after an outside review of these controls)

The review ran each default against the study's data and found five that did not hold together. Every figure below is computed by `tools/build_site.py` into `site/data.json` (key `controls`), using two optional hooks added to the replay (a promotion rule and a per-order cap); unset, the replay is the pre-registered one, and the build still checks it against `replay.json`.

- **A1. The plan rests on a minimum.** Under M2's default, the replay would have promoted no kind in its 33 weeks and paid 0 lines on its own. The 13 weeks of Phase 1 come from the replay's own single-crossing rule, so the timeline, Phase 1, the dry period and the costs now say "at least", and the stop rule notes it may end the pilot. With no mistakes, M2's default needs 545 independent calls, about 1,941 allowing for orders; the acceptance table shows it. I did not add a calibrated alternative default; a proposer may offer one under M2's pass mark.
- **A2. M2 is pass/fail.** A rule must keep the chance of ever promoting a kind whose true rate is below 99%, across all weekly looks of the planned Phase 1, at or below 5%, shown by simulation at a true 99.0% at the kind's volume and design effect, or on the issuer's earlier months.
- **A3. M3's second test is defined.** The lower end of the two-sided 95% Wilson interval of the error rate on every settled call paid alone since promotion must not rise above the upper end of the error interval the kind was promoted on. For the replay's first kind (promotion interval up to 0.98%), it fires at 5 wrong in the first 200 and 16 in 1,000. A line flagged by both outcome streams counts once.
- **A4. The count budget is a fixed number.** It is 1% of the lines Phase 2 is planned to pay alone, written down at Gate 1, not a running share, which an early mistake would trip. For the replay's 844 lines it would have been 8; the replay had 15.
- **A5. The blind-check window is set in lines.** A window runs at least a month, until the kind has paid 1,050 lines alone, and no longer than a calendar quarter; fewer lines by then means all are checked and the power reached is reported. On paper 2 of the 18 kinds the rulebook pays reach 1,050 lines a month; the replay's first kind pays about 733 (71% power on a month of them). The cost default stays monthly, the cautious end, but now never counts more checks than lines paid alone, so the low scenarios cost less. The headline does move with the window: at the defaults the pilot does not pay with monthly windows and needs about 95.9% reviewed with quarterly ones; both are shown beside the decision.
- **A6. Settled.** Of the 123 paid lines corrected after clearing, 48% were corrected within 30 days, 72% within 60 and 84% within 90 (median 40 days). The 30-day default stays, and a correction found later still counts: the call is re-scored and the switch-off and budget are recomputed.
- **A7. M11 defines the whitelist:** built by the issuer on its earlier months, every cell of supplier × earlier corrections × goods received first whose worst likely case there is at least 99%; the proposal must reach 99% allowing for orders and pay more lines; if the whitelist misses 99%, against the cells that reach it.
- **A8. Looks.** The gate's own looks were 444 across 18 kinds (practice-mode weeks with settled calls); 330 was the chart's rows.
- **A9. Responsibilities.** Blind checks are accountable to the Finance Controller or Internal Control and run by the accounts-payable team lead; the audit trail is accountable to Internal Audit and write-once.
- **A11. The ask.** Section 1 asks to fund Phase 0's measurements; Gate 1 goes ahead only if they give a positive net after running costs.
- **A13. The cap's release and effect.** An order's later lines go to a person, as today. On the replay, a cap of 3 cuts lines paid alone from 844 to 260 and mistakes from 15 to 9. The money does not include it.

### Defaults and their effect on the study's data

| Default (mine) | Effect on the study's data |
|---|---|
| M2: 99.3% allowing for orders, 3 looks in a row | No kind promoted in 33 weeks; 0 lines paid alone |
| M12: 3 lines of one order | 844 → 260 lines paid alone; 15 → 9 mistakes |
| Settled at 30 days | 48% of post-clearing corrections known by then; later ones re-scored |
| Count budget: 1% of planned lines, fixed | 8 for the replay's 844; the replay had 15 |
| Blind checks: monthly cost, quarter at most | Doesn't pay at the defaults monthly; about 95.9% needed quarterly |
