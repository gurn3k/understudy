# 0030. The pilot request and the internal business case are two pages

## Status
Accepted 2026-11-21, after a review before going live. Every result was already known. This replaces decision 1 of ADR 0028 ("two documents on one page"). It changes the structure of the model pilot request (ADR 0020) only. It changes no study result, no figure and not the verdict (ADR 0016).

## Why
Under ADR 0028 the page said that sections 1 and 13 were the internal case and the rest went to every proposer. The split did not hold. Section 11, which went to proposers, held the issuer's own return by scenario: a negative net in every row, "not reachable", ROI and payback. Section 14, the narrative on why I recommend the desirable requirements, also went to proposers. A proposer would have been told the issuer's own verdict on whether the pilot pays, which weakens the issuer's position in pricing and negotiation. The page had also grown long enough that one page with a box saying which parts to send was hard to use.

## Decision
1. **Two pages, one script.** `site/rfp.html` is the request that goes to every proposer. `site/case.html` is the issuer's internal business case. `site/rfp.js` draws both and picks one from the page's `data-doc` attribute, so the figures stay shared and cannot drift apart. `rfp.html` keeps its address, so the links that already point to it still work.
2. **The request** has sections 1 to 12 and the appendices:
   - Section 1 is a new summary of the request: the plan, the timeline and the study's key figures. It has no cost or return figures.
   - Section 11 becomes "Cost lines to price". It lists the lines the proposer prices and the issuer's own lines, which are named but not priced. It also explains how the blind-check window is sized.
   - Appendix C holds the baseline measures, which used to sit at the end of section 11.
   - Where the request used to point to section 11 for the break-even, the Gate 1 net and the Gate 4 share, it now points to "the issuer's internal case". It quotes no figure from that case.
3. **The internal case** has four sections:
   1. the executive summary and the ask (the old section 1);
   2. the calculator, the cost lines at the reader's inputs, the saving and the return by scenario (the old section 11);
   3. the findings behind the desirable requirements (the old section 14);
   4. the sign-off (the old section 13).

   It links to the request's sections by number ("the request's section 7").
4. **Checked.** `tools/check_claims.mjs` loads all three pages. Each required figure is checked on the page it belongs to, and some are checked on both. A new banned list for the request alone fails the check on any return wording: return on the pilot, ROI, payback, net a year, "pays its way", "does not pay", "not reachable", "at these inputs", gross saving.
5. **Navigation.** The main report links to both pages: the opening links, the cue rail and Q9's "Where the evidence is". The internal case's top bar links to the request. The request does not link to the internal case, so a proposer is never one click from the issuer's return.

## Alternatives considered
- **One page, with the internal part folded or marked "do not send".** I rejected it. An issuer copying the page could still send the internal part, and a fold does not keep text out of the document.
- **Renumbering the request from 1 to 11 after dropping the old section 1.** I rejected it. Every "section N" cross-reference, requirement test and earlier decision record would have had to change, and a missing section 1 would read as an error. A new vendor-facing section 1 keeps the numbers.

## Not decided here
- Whether an issuer sends the request in the first person (ADR 0028).
- The contents of the issuer's contract.
