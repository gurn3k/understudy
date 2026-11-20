# 0028. The pilot request: who reads what, the ask, and how proposals are scored

## Status
Accepted 2026-11-20, after an outside review. Every result was already known. This changes the model request for a pilot proposal (ADR 0020) only: its ask, its requirements' wording and its evaluation. It changes no study result and not the verdict (ADR 0016).

## Why
The request mixed an internal approval note with a solicitation. A proposer could not tell which sections were meant for it, and the ask ("approve Phase 0") read as if the award and Gate 1 were the same decision. Its requirements assumed the study's own design, a rulebook, so a proposer offering another approach could not answer some of them as written. Its evaluation had weights but no scale, no price formula, no minimum and no tie-break.

## Decision
1. **Two documents on one page.** A "How to use this document" box says sections 1 and 13 are the internal case and are not sent to proposers; sections 2 to 12, section 14 and the appendices are the request.
2. **The ask.** Section 1 asks for approval to issue this request, with Phase 0 funded on award to measure the inputs that decide it. Gate 1 still needs those measurements to give a positive net after running costs (ADR 0025).
3. **Outcomes, not a design.** The requirements apply to "the decision component", whatever makes the pay-or-hold call on a line. The study's rulebook is the issuer's reference design, in Appendix E. The evidence sections still name what the study tested.
4. **Scoring.** M requirements stay pass/fail (ADR 0025). Every other criterion but cost is scored 0 to 5 against published descriptors; points are weight × score ÷ 5. Cost points are 20 × the lowest evaluated price ÷ the proposal's evaluated price, over the pilot at its longest. A proposal below 3 on either control or approach criterion, or below an issuer-set total, is not shortlisted. Ties go to the higher controls score, then the lower price. The weights, the minimum and the formula are my proposal; the issuer sets its own and publishes them.
5. **Commercial terms and submission** are placeholders the issuer completes before issue. No date, address, contact or legal entity is filled in.

## Not decided here
The issuer's contract, its liability and insurance positions, and whether to issue the request in the first person. The page keeps my first person.
