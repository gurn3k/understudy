# 0022. How the page words its result and its limits, after an outside review

## Status
Accepted 2026-11-20, after an outside review of the published page. Every result was already known. Nothing here changes a verdict, a bar, a rule or a fixed sentence (ADRs 0015 to 0018). It changes how the page describes them. The figures are computed by `tools/evidence.py` and `tools/build_site.py` into `site/data.json` (keys `evidence` and `post_result`), with tests in `tests/test_evidence.py`.

## Why
The review found wording that claimed more than the evidence carries:
- the replay called "safe" or "safer";
- the result framed as a near miss ("14 mistakes short", "a hair under");
- "every rule written down, except one" and "unseen";
- "only what was known", which hides a look-ahead in the inputs;
- a label described as if it had one obvious reading;
- no account of clustering on purchase orders.

## Decision
1. **No safety claims about the replay.** It shows trust earned on outcomes: 844 lines paid, 15 needed correction, all in one kind, 8 on one purchase order. The page says that, under the result strip, and calls it not proven either. The page's question ("which invoices are safe to pay") stays as a question.
2. **Not proven, with the figures that qualify it.** The rulebook was about 99% right on what it paid. Its worst likely case is 98.95%, and about 98.8% allowing for invoices on the same order (design effect 3.56; whole-order resampling 98.85% to 99.27%). Paying every invoice is shown beside it (96.85%), and so is the fall from the learning months' worst likely case (99.57%). Checking each invoice is described as about 1% wrong, the same as the rulebook on what it paid, while paying far fewer.
3. **The changes made after results, counted.** The Method section lists every decision record or amendment written after a test result was known, with its effect. The list includes the two look-aheads found after the runs: test outcomes helped choose the subject, and the learning months' rates include outcomes that landed later. Policy 1's pass is shown as not robust to clustering.
4. **The label moved one way at a time.** The pre-registered verdict stands. A box shows two moves. Dropping the 16 lines whose only correction was a delivery-indicator change gives 99.01%, or 98.89% allowing for orders: still not proven. Counting the 107 corrections made after clearing gives 98.52%, or 98.84% counting only those on single-receipt lines. The correction mix is published. The page says "needed a correction" rather than "wrong payment" outside fixed sentences. The pilot's Phase 0 has an accounts-payable reviewer sign off the corrective list, deciding explicitly on Change Approval for PO.
5. **The agreement gate: the mechanism first.** The case against it is that agreement from reviewers who copy carries no information about the AI. It isn't the count of mistakes. A sweep (`tools/run_sweep.py`, 20 runs a cell, no model calls) varies the copy rate (0.5, 0.7, 0.9), the catch rate (50%, 80%, 95%) and the false-flag rate (2%, 10%). At a copy rate of 0.9 the catch rate barely moves the result. At a 10% false-flag rate the gate never opens. The page shows rates beside totals, says "in this simulation" in the callout, and drops the "say, 95%" example. It also records the money logic: the simulated gate paid about 140 more lines for each extra mistake, so on the page's own money it nets more whenever a late fix costs less than 140 × share reviewed × the cost of a review. So "ten times the wrong payments" is not the reason for the pilot request's M2; lack of information is.
6. **One way to name a week.** Plain text says "week 13 of the replay (ISO week 35)". The decision records' fixed sentences keep their ISO weeks, with a note beside them, and the chart axis counts replay weeks. The pilot request notes that Phase 1's length rests on a promotion later withdrawn.
7. **A check that the old wording can't return.** `tools/check_claims.mjs` also loads the pilot request and fails on a list of forbidden phrases taken from this record and from ADR 0017's "Don't claim" section.

## Don't claim
- That the replay, or any gate, is safe or safer.
- That the rulebook nearly passed, or was some number of mistakes short.
- That the test months were unseen in every sense, or that the contenders used only what was known at the time.
- That the label's direction of error is known, or that a narrower label would prove the bar.
- That the post-hoc vendor baseline (ADR 0024) is a pre-registered result.
