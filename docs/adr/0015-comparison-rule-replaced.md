# 0015. The sample-based comparison can't separate contenders; replaced before the deciding runs

## What happened (kept on the record)
- ADR 0012 compared the contenders on pooled coverage at the 99% bar, on a shared sample of 1,500 invoices.
- The first live sample run (2026-11-15) showed this rule can't separate anyone. Policy 1 from contender C passes about 726 sampled invoices. At its real error rate, around 1 in 125, a 726-call sample holds about 6 errors, and its lower bound (97.7%) can't reach 99%. Reaching the bar needs at least 381 calls with 0 errors, or 563 with 1.
- On the full held-out set, the same policy passes 26,145 of 26,356 (99.20%, lower bound 99.08%), covering 48.0% of invoices.
- **Under the original rule's verdict, no contender clears the bar on the sample, so A wins by default.** That verdict is reported on the page.

## Decision (written before C's policies 2–3 and B's full sample run)
1. **A against C:** decided on all 54,874 held-out invoices, using ADR 0012's criteria. C must cover at least 10 percentage points more at the 99% bar, pooled. No case type with 100 or more of A's calls may have lower precision under C (A has none, so this can't bind). C's policy must pass the code checks.
2. **B against C (and B against A):** B can't be run on every invoice, so it's compared on the shared sample (see Amendment 1, item 4):
   - On the invoices both pass, precision is reported.
   - B wins over C only if B's sample coverage is at least C's and its observed precision is at least C's. Otherwise C wins.
   - Both are reported with their intervals, and labelled as underpowered for the 99% bar.
3. **Choosing among C's policies:** still decided on the earlier months only (ADR 0012). Policy 1's held-out result had already been seen when this ADR was written, but it plays no part in choosing.
4. **Unchanged:** the cost and speed comparison per 1,000 invoices.

## Why
The bar has to be testable with the evidence available. B's cost is the reason it can't be scored on every invoice, and that is itself a finding about scale.

## Consequences
The A-vs-C decision now rests on the full held-out set. The B result is weaker evidence, and the page says so.

## Amendment 1: independent decision (2026-11-15, before any deciding result was read)
An independent reviewer accepted the replacement with these changes, now binding:
1. **Two verdicts, in this order.**
   - First, the pre-registered rule: no contender clears the bar on the sample, so A wins by default.
   - Second, the revised rule, labelled "written after one result was seen".
2. **Seen or unseen.** If the earlier-month choice picks policy 2 or 3, its held-out result is marked "unseen when the rule was written". If it picks policy 1, it is marked "seen".
3. **No reruns or edits.** Policies 2–3 and B's prompt aren't rerun or edited after any held-out figure is seen. All three policies' held-out results are published.
4. **B against C** replaces item 2's clause. On the shared sample, against the chosen C policy:
   - B wins only if its coverage is at least C's, and a one-sided exact sign test favours B at p ≤ 0.05 on the invoices wrongly passed by exactly one of the two.
   - The mirror result means C wins.
   - Anything else is "not separated", and the lower cost per 1,000 invoices decides (ADR 0012's tie-break).
5. **B against A** stays under ADR 0012's sample rule. If B doesn't meet it, the page says "not shown at the bar".

**Disclosure on the page:** "The comparison rule was changed after the first policy's held-out result was known and before any other contender ran; under the original rule no contender clears the bar and the fixed rule wins by default, and both verdicts are shown."
