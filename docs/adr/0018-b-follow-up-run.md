# 0018. A follow-up run of B on 10,000 new invoices (decided 2026-11-16 by an independent reviewer, before any call)

## Why
On the 1,500-invoice sample, B (Claude judging each invoice) passed 88 and got 1 wrong. Its lower bound was 93.8%. With one error, proving 99% takes at least 563 passes, so that sample could never settle whether B reaches the bar. The owner approved one follow-up run of B, on the same decision only.

**This amends ADR 0015 Amendment 1 item 3** ("B's prompt isn't rerun after any held-out figure is seen"). It allows one owner-approved follow-up, on new invoices, labelled as a follow-up wherever it is reported.

## What had already been seen when this was written
- B's 88 passes and 1 error on the first sample.
- A's and C's results on all 54,874 held-out invoices. These include the new sample's invoices.
- B's prompt was never tuned on any held-out invoice. It is unchanged since before B's first call.

## Decision
1. **Sample.**
   - 10,000 held-out invoices not in the 1,500 sample. The code asserts there is no overlap.
   - Stratified by case type in proportion, with the first sample's code and seed 20261116.
   - Locked by checksum (`docs/sample2.sha256`) before any call.
   - A and C's chosen policy (policy 2, fixed) are scored on the same invoices.
2. **Same as the first run, or the run stops.**
   - These must equal the first run's: the system prompt (SHA-256 `dc42aed6…781e`), the model (`claude-opus-5-5`) and the earlier-month data B reads (SHA-256 `b0e565c2…7ea4`).
   - Batches are built the same way, 25 invoices per call.
   - Each call records its prompt hash. Responses are saved apart from the first run's.
3. **Run order.**
   - The sample is stored in a seeded random order and run in 10 blocks of 1,000 invoices (40 calls each). Any completed run of blocks from block 1 is a random subsample.
   - Block 1 counts in the sample.
   - Answers that fail the code gate count as "leave to a person" (ADR 0012).
   - A call is retried only when no response arrives, with the identical request, at most twice.
   - Nothing is fixed or changed after block 1.
4. **Pilot and stop rule.**
   - Block 1 measures only usage, wall time and gate failures. No accuracy figure is computed or looked at until the run ends or stops.
   - The projection is the owner's weekly usage now plus 9 × block 1's usage.
   - If that projection exceeds 75%, only as many whole blocks run as fit. If fewer than 7 blocks fit, the run stops after block 1 and is reported as "too small to decide". At about 6% coverage, fewer than 7 blocks gives under 381 passes, so 99% could not be proved even with no errors.
   - Stopping depends on usage only.
5. **Primary question: does B prove 99% on what it passes?** There are three outcomes:
   - **Proved:** pooled 95% Wilson lower bound ≥ 0.99.
   - **Below the bar:** upper bound < 0.99.
   - **Not proved:** anything else.

   Coverage is always reported next to the outcome. At about 590 passes, "proved" needs 0 or 1 wrong. At the first run's rate (1 in 88), it will not be proved.
6. **B against C on the new sample.**
   - This uses ADR 0015 Amendment 1 item 4: coverage at least the other's, and a one-sided exact sign test at p ≤ 0.05 on the errors only one of them made. Otherwise the result is "not separated", and the cheaper one is preferred.
   - It is reported as a follow-up only. ADR 0016's verdict stands.
7. **B against A.** A passes nothing, so B beats A only with coverage ≥ 10% and a lower bound ≥ 0.99.
8. **No pooling** with the first sample, which is reported as it was. No subgroup claims: a per-type table is descriptive only.
9. **No further run.** If the result is inconclusive, the page says so with the new numbers.
10. **Before the first call:** this ADR, the sample checksum and the scoring code (`tools/score_b2.py`) are committed. The scoring code must first reproduce 88 / 1 / 93.8% on the old sample. No analysis is made outside items 5–7.

## Page sentences (exact, numbers filled from the result)
- **Disclosure:** "This follow-up was run after the first results were seen, because the first sample was too small to settle the question. The prompt, model and settings were unchanged, and the invoices were new."
- **Proved:** "On {n} new invoices, Claude judging each one passed {passed} ({coverage_pct}%) and got {wrong} wrong. That proves it is right at least 99% of the time on what it passes (lower bound {lower_pct}%). It passes too few to count under the rule, which needs 10%."
- **Not proved:** "On {n} new invoices, Claude judging each one passed {passed} ({coverage_pct}%) and got {wrong} wrong. That does not prove 99%: the true rate could be as low as {lower_pct}%. No further run was made."
  - **If below the bar, add:** "Even its best case, {upper_pct}%, is under 99%."
- **B wins:** "On the same invoices, Claude judging each one passed at least as many as the written policy ({b_passed} against {c_passed}) and made fewer wrong passes the other avoided ({b_only} against {c_only}). A gap this size is unlikely to be chance (p = {p})."
- **C wins:** "On the same invoices, the written policy passed at least as many ({c_passed} against {b_passed}) and made fewer wrong passes the other avoided ({c_only} against {b_only}). A gap this size is unlikely to be chance (p = {p})."
- **Not separated:** "On the same invoices neither clearly beat the other: case-by-case passed {b_passed} with {b_wrong} wrong, the written policy {c_passed} with {c_wrong} wrong. The cheaper one is preferred: {c_cost} once against {b_cost} per 1,000 invoices."

## Consequences
B's result can become conclusive. If it proves 99%, it still passes too few invoices to count against A under ADR 0012. The cost of this run is reported with the others.
