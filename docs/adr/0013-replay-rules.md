# 0013. Earned-autonomy replay rules (fixed before any replay)

## Decision
- **The weeks:** held-out invoices are replayed in the ISO week of their first invoice receipt, June to August 2018 plus the weeks their outcomes land.
- **Shadow mode:** each contender starts in shadow mode in every case type. It makes calls, but people handle every invoice.
- **When evidence counts:** a call's outcome becomes evidence only from the week the invoice cleared.
- **Promotion:** at the end of a week, a case type is promoted if the contender's resolved straight-through calls there pass the trust rule (99% Wilson lower bound). From then on, its straight-through calls in that type are acted on.
- **Demotion:** if the Wilson upper bound of the last 200 resolved autonomous calls in a type falls below 99%, the type goes back to shadow mode, and the count starts again.
- **Reported per contender and per week:**
  - case types promoted
  - invoices passed straight through autonomously
  - wrong payments let through (passed, but they needed correcting)
  - manual touches removed (the manual Clear Invoice and Remove Payment Block events on correctly passed invoices)
- **Who is replayed:** A and C on all held-out invoices. B isn't, because of cost; the page shows B's cost at that volume instead.

## Alternatives
Promote on calls made rather than outcomes known, which uses the future; never demote.

## Why
In a real rollout you learn an invoice needed correcting only later. Promotion has to wait for outcomes, and demotion is what makes autonomy safe to grant.

## Consequences
The first promotion comes weeks into the replay, by design.

## Amendment 1 (2026-11-15, before any replay ran)
Timing comes from a separate file, `heldout_timing.jsonl`, keyed by invoice ID. It holds the first invoice receipt time, the first clearing time and the count of manual touches. The locked held-out file is unchanged, and the contenders never see timing.
