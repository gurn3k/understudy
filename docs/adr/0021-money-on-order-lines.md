# 0021. The money re-based on order lines a person reviews, with one break-even

## Status
Accepted 2026-11-20, after an outside review of the published page found the business case counted bulk postings as human checks. Every result was already known. Nothing here changes a verdict, a bar or a fixed sentence (ADRs 0015 to 0018). It supersedes parts of ADR 0019 and ADR 0020, listed at the end, and is labelled on the page as a re-basing after review.

## Why
ADR 0019 item 2 counted "touches taken off desks" as the manual clearing and block-removal steps on the 26,715 order lines the rulebook would have paid (31,368 in three months), then turned them into hours, full-time people and dollars. ADR 0019 item 1 and the page said people handle nearly every invoice, because 93.6% of those steps sit under staff logins.

The review checked what those steps are. Most are bulk postings: one login clearing many lines in the same minute (one login made 85.6% of the clearings, in a few hundred distinct minutes). A step under a staff login is not a person reviewing a line. On the paid lines, only 652 of 26,715 (2.4%) show a manual step, besides the clearing, that is not part of a bulk group. The log can't show a review, and it can't show the absence of one either. So the saving can't be measured from these records, and the check count overstated it by an unknown amount.

The review also found three break-evens on two units (checks and touches), the headline one for the setup I don't recommend, a late-fix cost with no basis, and a pilot cost that left out most of the work.

## Decision
Every figure is computed by `tools/money.py` and `tools/build_site.py` into `site/data.json` (key `business`). None is typed by hand. `tests/test_money.py` covers the new code.

1. **One unit: the order line.** The records have no invoice-document field, so one "invoice" in the study is one order line. Volume, mistakes, late fixes, values and the benchmarks to collect are all per order line. A (purchase order, first-receipt minute) group is shown as a rough count of invoice documents: 9,347 groups for the 26,715 paid lines.
2. **The saving from two inputs a company measures first.** Saving a year = order lines paid a year × the share of these lines a person reviews today × minutes per review ÷ 60 × hourly cost. The share has no default. Until a reader enters it, figures that need it use every line (100%) and say it is an upper limit, not a plan. The touch count, hours, full-time people and dollar tiles built on it are withdrawn, as is the "people handle nearly every invoice" premise.
3. **The footprint, shown as a footprint.** The page shows the share of paid lines with an isolated manual step (a step under a person's login, other than the clearing, whose login, minute and activity group has fewer than 10 steps across the log): 2.4%. It also shows the share with a block released under a person's login: 19.4% of paid lines, and 19.9% of all test lines. Both are labelled "a footprint, not proof of review". Neither is used as a measure of effort.
4. **One break-even rule, two rates side by side.** The rulebook pays off while a late fix costs less than lines paid per mistake × share reviewed × cost of a review. On paper (trusted from day one), 107 lines per mistake (worst likely case 95). Gated (trust earned on outcomes in the replay), 56, with a likely range of 34 to 93 from the 95% interval on its error rate. Its 15 mistakes include 8 on one purchase order, so even that range assumes independence. "Worth piloting" is decided on the cautious end, 34. The page also states the smallest share reviewed that makes it pay off at the reader's late-fix cost.
5. **A late fix, split.** Its cost = the work to fix a line after payment + the share of its value never recovered × the line's value. Both parts are inputs, with defaults of $100 and 0% labelled as my assumptions. The page anchors the second part with the mean value of a wrongly paid line ($6,115, or $752 if the largest tenth of lines always went to a person). It also shows how much of that value the time saved could cover even if every line were reviewed: about 6% (48% with that tenth sent to a person) on paper, and less at the cautious end. The value is labelled order-line net value.
6. **An honest pilot cost.** The pilot request drops the "pilot cost as a share of the saving" tile and labels the computed cost "internal oversight only". The cost lines add required entries: blind checks sized to catch a doubled error rate, which means 1,050 lines a kind of invoice per check window (the switch-off test on 1,050 lines catches a true 2% error rate 84% of the time; at 5 minutes, about 88 hours a kind a window). They also add weekly reconciliation of calls against outcomes, supplier fees, model use, hosting, outcome scoring, audit and training. Phase 0 (about $1.3k at the defaults, plus integration) is a separate line. The page states that the pilot saves nothing for about 17 weeks (Phase 0 and Phase 1).
7. **Gross and net, with a downside row.** Money is labelled gross or net. The Q9 table and the pilot request's return table show 0% earned and the replay's observed share, 844 of 26,715 lines (3.2%, a window too short for the steady state), beside the scenarios. Late fixes in both use the cautious end. No upside row is shown for the Sales kind's later promotion.

## Not claimed
- Any share of lines a person reviews today. The records can't show it either way.
- That the footprint measures effort, or that its absence means no review.
- Any real minutes per review, hourly cost, or cost of a late fix. All are inputs or stated assumptions.
- That the gated range is a clustered interval. It treats the 844 lines as independent, and 8 of the 15 mistakes are on one order.
- A steady-state saving, a forecast of the earned share, or a full pilot cost. The required lines are blank for the issuer and proposers to fill.
- That a value limit would help (ADR 0019 item 6 stands).

## Supersedes
- **ADR 0019:** item 1's premise ("people handle nearly every invoice", 93.6%), its break-even in checks (26,715 ÷ 249 per check), and its default hourly framing per check. Item 2 entirely (touches, hours, full-time equivalents, money). Item 4's comparison now uses lines and a share (844 of 26,715). The page's renamed "manual clearing and block-removal events" keeps its count, now described as steps under staff logins, mostly bulk postings.
- **ADR 0020:** the "saving on paper" and "pilot cost as a share of the on-paper yearly saving (a gross ceiling)" figures. The second break-even in the addition of 2026-11-18 ("counts every manual step", with the higher of the test and replay rates) is replaced by the one rule in item 4 at the cautious end. The $100 late fix becomes the two-part late fix in item 5. The cost model's lines are as in item 6.

## Where
Q9 on the main page (sections 1 to 4, the inputs, the tiles and the detail fold), short notes in Q1, Q2 and Q5 on what "by hand" counts, and the pilot request's sections 1, 2, 3, 5, 7, 9, 11 and appendices A and B.
