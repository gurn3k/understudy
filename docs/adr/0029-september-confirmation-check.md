# 0029. A later check on September 2018, fixed before it runs

## Status
Accepted 2026-11-20, before the run. Every June to August result was already known. No September outcome had been computed or read when this was written: the September lines were selected and counted by date only. This record fixes the question, the approaches, the outcome window, the tests, what each result changes and the bug rule. It runs once. It changes no study result and not the verdict (ADR 0016) by itself.

## Why
An outside review asked whether the rulebook (policy 2) and the supplier shortlist checked after the fact (ADR 0024) hold on a month nobody has looked at. The log runs past the test months, but it thins out in December 2018 and effectively stops in January 2019, so later months are censored: many of their lines never clear inside the log. September 2018 is the latest month that can still be followed for a useful length of time, so I use it, with a fixed outcome window and stuck lines handled as bounds.

## Decision

### 1. The question and the frozen approaches
On order lines both created and first invoiced in September 2018, lines that no part of the study has seen, do the rulebook and the supplier shortlist still meet the bar, and did they do worse or better than on June to August?
- **Check only.** Nothing is changed before the run. Lessons go into the write-up, not into fixes.
- **The rulebook:** policy 2 exactly as saved (`responses/c/c_policy_2.json`, the policy the study chose), through `contender_c.decider`.
- **The supplier shortlist:** exactly as on the page. The key is "supplier, earlier corrections, goods received first"; the cells are those whose January to May 2018 record has a Wilson lower bound of at least 99%, from the same learning-month file (`invoice_triage_fit.jsonl`). The script checks that the study's selection rule still picks that key.
- **Paying everything** is scored as context only. No test applies to it.
- **The record** for each line is what was known at its first invoice receipt, with the same fields as the study's records (`triage.py`). On June to August the script rebuilds every locked record and stops if any field differs.

### 2. Which lines
Selected by dates only.
- **The main set, which decides the readings:** every order line whose first "Record Invoice Receipt" and first "Create Purchase Order Item" both fall in September 2018 (UTC months): **4,227 lines**. None of them can sit in the learning months' or the test months' records, which were selected by creation month (January to May and June to August 2018).
- **A second set, reported only:** every line whose first invoice receipt falls in September 2018, created any time: 19,708 lines. By creation month, 1,132 were created in January to May 2018, 14,349 in June to August 2018 and the 4,227 above in September. Many of the older ones sit in the learning or test records, so their outcomes have been seen. The run reports how many are in each file (by line id), scores this set and applies the same tests to it, and none of that changes anything in section 7.

Both lists are locked (section 10).

### 3. The outcome window: N = 109 days
N is the longest window that every September line can fully observe before the log effectively ends. It was set from event dates alone (`tools/confirm_sept.py coverage`):
- Events per month hold at 120,000 to 140,000 through November 2018, then fall to 92,526 in December and 44,747 in January 2019. After that the log has 7 events in the whole of February to December 2019.
- The last day with at least 100 events is 2019-01-17 (2,312 events). Only 22 events come after it: 15 on 2019-01-18 and 7 later. Any threshold from 16 to 2,312 events a day picks the same day. So the log effectively ends at 2019-01-18 00:00 UTC.
- A line first invoiced at the very end of September (any time before 2018-10-01 00:00 UTC) can see 109 whole days before that end. N = 109.

A line's outcome is read only from its first invoice receipt to 109 days after it (inclusive):
- **Wrong:** a correction (the study's list, `triage.is_corrective`) after the first receipt and before the first clearing after it, within the window.
- **Fine:** that clearing came within the window, with no correction before it.
- **Stuck:** no clearing within the window, and no correction in it.

With no window this is the study's label: on the locked June to August lines, "fine" equals the study's "straight through" on every line.

### 4. Stuck lines are bounds
- **The main figure** leaves stuck lines out.
- **The worst case** counts every stuck line as wrong.
- A line with a correction before it got stuck is wrong in both.
- **The stuck share** is reported for each approach and for each kind (category and spend area), of the lines it paid and of all lines.
- If a test's verdict differs between the main figure and the worst case, that test is **unsettled**.

### 5. The interval
Each figure has a purchase-order interval by the study's existing method: resampling whole purchase orders (`evidence.po_bootstrap`, seed 20261120, 2,000 draws), giving a 95% interval of the share fine. That bootstrap is the interval both tests use. Wilson on the design-effect sample size (`evidence.clustered_lower`'s method) is reported alongside and decides nothing, with one exception. When a figure has no wrong line, every bootstrap draw is 100% fine and the bootstrap collapses to [100%, 100%]. In that case the design-effect Wilson decides instead, which at zero wrong is plain Wilson. For example, 100 lines with none wrong give a lower end of 96.30%, not 100%.

### 6. The two tests and the readings
Applied separately to the rulebook and the shortlist, on their pooled figures, each on the main figure and on the worst case:
- **(a) The bar.** The lower end of September's interval reaches 99% or more. Pass or fail.
- **(b) Against June to August**, under the same 109-day window, main against main and worst case against worst case, in error rates. The deciding comparator is June to August picked the same way as the main set: lines created and first invoiced in the same month, June, July or August 2018, including lines that never cleared (section 9). The locked test file, re-scored under the window, is reported alongside and decides nothing.
  - **held up** if September's interval and June to August's interval overlap;
  - **did worse** if September's interval lies wholly above June to August's error rate;
  - **did better** if it lies wholly below.
  
  Overlap is checked first; two intervals that don't overlap put September's wholly on one side of June to August's rate. "Held up" means no detectable shift, not proof of no shift.
- A test whose verdict is the same on the main figure and the worst case takes that verdict. Otherwise it is **unsettled**. If an approach pays no September line, or pays only stuck lines (so the main figure has no lines), both tests are unsettled.

### 7. What each result changes
The headline never changes: it stays "not proven". Only supporting lines change, and only as follows. The write-up goes in a new Method section, "A later check: September 2018", whatever the result.

**The rulebook:**
- If test (a) reads **pass**, the page gets one line: "On September 2018, a later month nobody had looked at, the rulebook cleared the bar. One month isn't enough to reverse the main test; the pilot is how to find out." The pass marks in the pilot request are unchanged.
- If test (b) reads **did worse**, the rulebook's evidence lines and its role as the pilot request's reference design are softened.
- If both happen, both apply.
- Any other reading (fail, held up, did better, unsettled) changes no supporting line. It is reported in the Method section only.

**The shortlist:**
- If it **fails either test** (test (a) reads fail, or test (b) reads did worse), the pilot request's requirement becomes: "beat the same shortlist rule, refitted on the issuer's own recent data in Phase 0".
- If it **holds up** (test (a) reads pass, and test (b) reads held up or did better), 99.51% stays, with the note "held up on a later month".
- If neither (a test is unsettled and neither fails), 99.51% stays without the note, and the Method section says it was unsettled.
- A fail that came with few paid lines still triggers the refit requirement. The write-up says how few.

### 8. Bugs
- Before scoring September, the script must reproduce June to August with no window: policy 2 pays 26,715 lines with 249 wrong, and the shortlist pays 7,532 with 23 wrong. It stops otherwise.
- The script, the code it imports, its inputs and the September line list are locked by checksum (section 10). The list is selected by date only. The run refuses unless every checksum matches.
- After the run, a fix is allowed only for a mechanical error that an independent reviewer (Opus) confirms. Both results are then published, with the change explained. There are no other re-runs.

### 9. June to August, re-scored under the same window
Outcomes already known. Both comparators are scored under the 109-day window.

**The deciding comparator.** These are the 14,598 lines created and first invoiced in the same month, June, July or August 2018, picked from `cases.jsonl` the way September's main set is, with lines that never cleared included. Each line is scored with the same record and outcome code:

| Approach | Paid | Stuck (share) | Main figure: wrong / lines, share fine | Main, PO interval | Worst case: wrong / lines, share fine | Worst case, PO interval |
|---|---|---|---|---|---|---|
| Rulebook (policy 2) | 7,778 | 86 (1.11%) | 88 / 7,692, 98.86% | 98.27% to 99.28% | 174 / 7,778, 97.76% | 96.84% to 98.54% |
| Supplier shortlist | 2,196 | 81 (3.69%) | 12 / 2,115, 99.43% | 98.94% to 99.81% | 93 / 2,196, 95.77% | 92.99% to 97.94% |
| Paying everything (context) | 14,598 | 256 (1.75%) | 390 / 14,342, 97.28% | 96.71% to 97.76% | 646 / 14,598, 95.58% | 94.76% to 96.33% |

The per-kind figures are in `docs/confirm/june-august-matched.json`.

**Alongside, deciding nothing: the locked test file.** These are the 54,874 test-month lines:

| Approach | Paid | Stuck (share) | Main figure: wrong / lines, share fine | Main, PO interval | Worst case: wrong / lines, share fine | Worst case, PO interval |
|---|---|---|---|---|---|---|
| Rulebook (policy 2) | 26,715 | 864 (3.23%) | 245 / 25,851, 99.05% | 98.82% to 99.26% | 1,109 / 26,715, 95.85% | 94.82% to 96.76% |
| Supplier shortlist | 7,532 | 219 (2.91%) | 23 / 7,313, 99.69% | 99.50% to 99.85% | 242 / 7,532, 96.79% | 94.32% to 98.33% |
| Paying everything (context) | 54,874 | 2,270 (4.14%) | 1,695 / 52,604, 96.78% | 96.33% to 97.16% | 3,965 / 54,874, 92.77% | 92.00% to 93.55% |

With no window, the same script gives 26,715 paid and 249 wrong for the rulebook, and 7,532 and 23 for the shortlist, as published. Four of the rulebook's 249 wrong lines were corrected only after day 109 and cleared later still; under the window they are stuck. The full figures, per kind included, are in the data folder (`confirm_baseline.json`); the pooled ones are in `docs/confirm/june-august-window.json`.

### 10. The lock
`docs/confirm/sept-2018.lock` locks two September lists, both in the data folder: the main list (`sept_2018_main.txt`, 4,227 ids) and the second list (`sept_2018_all.txt`, 19,708 ids). It also locks the scoring script (`tools/confirm_sept.py`, line endings read as `\n`), the code it imports, the saved policy 2 reply, the learning-month and test-month record files, and the parsed log `cases.jsonl` (raw bytes), which is the source of every September record and outcome. The lock's comment lines record the raw log's MD5 (`4eb909242351193a61e1c15b9c3cc814`). Month 2018-09, window 109 days. The checksums (SHA-256):
- Main list, `sept_2018_main.txt` (4,227): `ab019a8e2ff3ee6e0563ca2e364994a4d834a300b0aa16637f06f745bd3bf973`
- Second list, `sept_2018_all.txt` (19,708): `fedef8c29ecd44da1996ffde5fd8d6794464a46779259a4378735ed021fdaddc`
- Scoring script, `tools/confirm_sept.py`: `5dafe4de7040775ed583e23d84990c7c5ed7d16fe058e42bf4ada65e7358ae90`
- `cases.jsonl`: `098dde8152fa066cee7172ba61981e0c4e06fade7e3b3979fc6e4056e81f2ae6`

The rest are in the lock file. An earlier lock, written before an outside sign-off changed the main set, the comparator and the script, was removed and replaced. History keeps both.

## Alternatives
- **Every line first invoiced in September, created any time (19,708).** Not the main set: most were created in the learning or test months, and many sit in those records, so their outcomes have been seen and test (b) would partly compare September with itself. Reported only.
- **Every line created in September, invoiced any time.** Rejected: a line first invoiced in October or later can't be followed for 109 days before the log ends. Taking the lines that are both created and first invoiced in September avoids that, since the window counts from the first invoice receipt.
- **A later month, or several.** Rejected: from October on, the window a whole month can observe shrinks quickly, and the share of lines that never clear in the log rises steeply.
- **No fixed window (follow each line to the log's end).** Rejected: September lines would get a shorter follow-up than June to August lines, which would flatter September.

## Known limits, fixed now
- **Overlap with earlier months, in the second set only.** Of the 19,708 lines first invoiced in September, 15,481 were created in the learning or test months, and those that cleared sit in the learning or test records. The main set has none of them. The overlap affects only the second set, which decides nothing.
- **A smaller sample, so less power.** The main set has 4,227 lines, and each approach pays only part of them. Its intervals are wider than June to August's, so test (a) is harder to pass and test (b) is less able to detect a shift. A fail that comes with few paid lines is flagged as such in the write-up; it still counts (section 7).
- **June to August has no never-cleared lines.** Its locked file holds only lines that cleared before the log ended, so its stuck lines all cleared late. September's can include lines that never cleared. This lowers June to August's stuck share against September's, which matters for the worst case only.
- **The worst case is harsh.** Under the window, June to August's own worst case is 95.85% for the rulebook and 96.79% for the shortlist. If September's stuck share is anything like it, test (a) on the worst case fails, so test (a) can read fail or unsettled but is unlikely to read pass.
- The rulebook's June to August main lower end under the window is 98.82%, so test (a) reads fail on June to August itself; the shortlist's reads unsettled; the pass line and the "held up" note are not realistically reachable. (Those figures are from the locked test file. On the deciding comparator the lower ends are 98.27% for the rulebook and 98.94% for the shortlist, so test (a) reads fail for both.) Decision 3 stands regardless. Before September is scored, the run checks that each comparator's error rate lies inside its own interval, for both tested approaches, on the main figure and the worst case. It also reports each comparator read against itself, as context.

## Consequences
- The run is `python tools/confirm_sept.py run`. It writes `confirm_sept_result.json` in the data folder, with the readings and what they change.
- The write-up follows section 7. A new decision record, or an amendment here, carries the result, and the changes-after-results table gets a row.
- An independent reviewer signs off this record before the run, and rules on the write-up after it.
