# 0026. Evidence belongs to the rulebook version that earned it

## Status
Accepted 2026-11-20, after an outside review. Every result was already known. This changes what the model request asks of a proposer (M5) and how the main report's cost section is read (Q7). It changes no study result and not the verdict (ADR 0016).

## Why
Q7 priced a rulebook rewritten every month. The pilot request trusts a kind of invoice only on months of settled outcomes (M2, ADR 0025). Nothing said whether that evidence carries over when the rulebook is rewritten. If it does, a new version is trusted on calls it never made. If it doesn't, a monthly rewrite sends every kind back to practice mode every month, and no kind could ever be trusted.

## Decision
1. **Evidence belongs to the version that made the calls.** A kind's practice-mode record and any promotion count only for the rulebook version that earned them.
2. **A kind keeps them under a new version only if its rules are unchanged.** Every rule that can apply to that kind must be the same in both versions. The signer confirms this by comparing the two versions, and checks it by running both versions on every line of that kind logged so far and getting the same call on each. The same calls alone don't prove it: a changed rule may apply only to lines not yet seen. Any other kind goes back to practice mode with no evidence.
3. **Earlier calls don't count for a changed kind.** A new version is written after its author has seen outcomes, so scoring it on those same lines would flatter it.
4. **Q7's monthly rewrite is a ceiling on cost, not a pace.** The rulebook costs so little to write that the yearly figure hardly moves. The rules for a kind that is earning trust would change far less often than monthly.
5. **The request (M5) says so,** with a test: a seeded rewrite that changes one kind's rules sends that kind, and only that kind, back to practice mode. R4's mitigation points to it.

## Not decided here
How often a company rewrites its rulebook. That depends on how fast its suppliers, prices and buying habits change, and on how much volume each kind has. The request leaves it to the issuer.
