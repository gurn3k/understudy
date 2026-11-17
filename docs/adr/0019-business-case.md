# 0019. The business case: additions written after the verdict

## Status
Accepted 2026-11-17 by an independent reviewer, with changes, all applied here. Every result was already known when this was written: the verdict (ADR 0016), the replay (ADR 0017) and the B follow-up (ADR 0018). Nothing here changes a verdict, a bar or a fixed sentence. Everything it adds is labelled on the page as added after the results, for a business reader.

## Why
The page answers "did any approach earn trust at the 99% bar?" A business leader also asks what it would save, what a mistake costs, and what to do next. These additions answer those questions from the same records. They don't move the bar. The owner placed the business case first on the page; the technical sections follow unchanged.

## Decision
Each figure is computed by `tools/build_site.py` into `site/data.json` (key `business`). None is typed by hand. The chosen rulebook is policy 2 on all 54,874 held-out invoices.

1. **What a mistake can cost before the rulebook stops paying off.**
   - Today people handle nearly every invoice before it is paid (93.6% of clearing events are manual). Each of the 249 wrong passes was corrected before payment (ADR 0009). The rulebook would pay it first and fix it after. *M* includes any amount that can't be recovered after payment.
   - Let *c* be the cost of one manual check (minutes × hourly cost ÷ 60), and *M* the extra cost of fixing an invoice after payment instead of before.
   - The rulebook saves 26,715 × *c* in checks and adds 249 × *M* in late fixes. It pays off while *M* ≤ about 107 checks' worth (26,715 ÷ 249). At the worst likely case (lower bound 98.95%), that is about 95. Hourly cost is in EUR, to match invoice values (default €40, an assumption). The reader sets minutes (2, 5 or 10, the PRD's range) and hourly cost.
2. **Touches and hours taken off desks.**
   - Touches taken off desks on paper = the manual touches on the 26,715 invoices the rulebook paid, counted the way ADR 0013 counts them (heldout_timing), over the three held-out months. A yearly figure is that × 4, labelled "assumes no seasonality".
   - Hours = touches × minutes ÷ 60, at 2, 5 and 10 minutes. Full-time equivalents at 1,800 hours a year. Money = hours × the reader's hourly cost.
   - The page renames 227,548 to "manual clearing and block-removal events in the log".
   - The rulebook costs about $0.40 once to write and nothing per invoice to run (ADR 0016).
   - This is the rulebook's figure on paper, before it earns trust; item 4 shows the earned figure. The page says so.
3. **Money at stake in the mistakes.**
   - Sum and median of `invoice_value` (EUR, as recorded) for the 249 wrong passes, the 26,715 paid invoices, and all held-out invoices.
   - Wrong passes are 0.93% of invoices paid but 3.2% of their value (€1.29M of €39.75M). The rulebook would have paid 249 of the 1,730 problem invoices (14%) without a check.
   - Stated as "value the rulebook would have paid before a needed correction", not money lost.
   - The page notes that wrong passes have a higher median value than paid invoices overall. This is a description, not a tested rule.
4. **The earned first year.**
   - ADR 0017's corrected sentences, exactly as fixed.
   - With ADR 0017's limit: the window was too short for the outcome lag.
   - Set beside the on-paper figure for the same held-out invoices (26,715 paid), never the yearly figure. 844 understates steady-state volume, and the page doesn't estimate the steady state.
5. **A recommendation.**
   - Drawn only from the replay (ADR 0013, 0017). Run the rulebook in practice mode (shadow) on every kind of invoice. Let a kind pay on its own only when its outcomes prove 99%, and switch it off on the replay's rule. In the replay this setup still paid 15 wrong of 844 (1.8%) before withdrawal, so plan for errors in the first months. Fix the bar and your cost of a late fix (item 1) before the pilot starts. Expect the first kind to qualify after months, not weeks.
   - Labelled as a recommendation, not a result.
6. **A value limit, proposed for the pilot (added at the owner's request).**
   - Concept: invoices above a set amount always go to a person, whatever the rulebook says. This is a common control in accounts payable.
   - Evidence shown is descriptive only: the medians in item 3, and how concentrated the wrong-pass value is among the largest paid invoices. For example, the share of wrong-pass value in the top 10% of paid invoices by value, with the top-10% line taken from the paid invoices themselves.
   - The limit is not fitted, chosen or scored on the test invoices. The page says a business would set it from its own policy or its earlier months before a pilot, and test it there.

Cut by the reviewer: a table of results under other bars (98%, 99.5%). That is the forking path ADR 0016 names. Item 1's break-even lets a reader set a bar from their own costs before a pilot.

## Second ruling (2026-11-17, on the built section)
The same independent reviewer accepted the built section with eight wording changes, all applied. The headline now says invoices, not checks; "would have paid" replaces "paid"; the value-limit section is titled "proposed, not tested" and describes where the mistakes' value fell without claiming a limit would help; the recommendation says to consider a value limit set before the pilot, and draws otherwise only on the replay. Removing the largest tenth after the fact would appear to clear the bar; that is exactly the hindsight result this record forbids, and the page does not state it.

## Not claimed
- That any approach met the 99% bar, or that a different bar changes the verdict.
- How the rulebook would score under any bar other than 99%.
- That invoice value is money lost.
- That a value limit would have reduced the mistakes or kept the rulebook above the bar.
- Any real hourly cost, minutes per check, or cost of a late fix. All three are the reader's inputs or stated assumptions.
- Steady-state savings from the replay.

## Where
The first section of the page, "The business case". All technical sections (Q1 to Q8, Method) stay unchanged below it, apart from the renamed 227,548.
