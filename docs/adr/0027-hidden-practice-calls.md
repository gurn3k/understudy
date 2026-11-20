# 0027. Practice calls are hidden, and the override rate is dropped

## Status
Accepted 2026-11-20, after an outside review. Every result was already known. This changes what the model request asks of a proposer (M1, and the desirable requirements in ADR 0020) and three lines of advice on the main report (Q5, Q6, Q8, Q9). It changes no study result and not the verdict (ADR 0016).

## Why
The request asked for practice mode with people handling every invoice, but did not say whether they could see the rulebook's calls. If they can, their decisions drift towards the calls, and the practice record measures how often they agreed, not whether the rulebook was right: the agreement simulation (ADR 0014) shows how far that can mislead. The request also asked proposers to track how often people overrule the rulebook (D3) without defining an override. With the calls hidden, a person has nothing to overrule, so the count has no meaning in practice mode. After promotion, a line paid on its own reaches no person, and the blind checks (M9) already measure the rulebook directly.

## Decision
1. **Calls are hidden in practice mode (M1).** No screen, report or queue order the people who handle invoices see shows or hints at a call. Phase 0 checks this.
2. **The override rate (D3) is dropped.** It is not redefined. The blind checks (M9) and outcome-based promotion (M2) do the job it was meant to do, without depending on what people saw.
3. **The main report's advice follows:** hide the calls while the AI practises, instead of tracking how often people overrule it.

## Not decided here
How a company hides the calls in its own systems. The request asks the proposer to describe it and the issuer to check it in Phase 0.
