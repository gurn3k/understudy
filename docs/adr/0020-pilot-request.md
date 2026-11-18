# 0020. A formal request for a pilot proposal, as a separate page

## Status
Drafted 2026-11-18. Ruled ACCEPT WITH CHANGES by an independent reviewer after the page was built locally, with six required changes, all applied: the RACI follows the segregation rule and keeps Internal Audit independent; the bar is counted on the calls the rulebook would pay, as in ADR 0013; the stop rule and phase lengths are labelled as my judgment; two outside-guide claims are hedged or cut; the cost tile is relabelled as a gross ceiling; and the reviewer's optional notes were taken. Nothing ships without the owner's go-ahead. Every result was already known: the verdict (ADR 0016), the replay (ADR 0017), the B follow-up (ADR 0018) and the business case (ADR 0019). Nothing here changes a verdict, a bar or a fixed sentence.

## Why
The owner asked for the business case to be revisited as a formal request for proposals in a corporation with a lot of process: structure and a one-screen summary, a firmer set of numbers, a leader's framing, a concrete pilot plan, and the missing pieces (pilot cost, benchmarks, wider risks). The page already answers "what could it save?" (Q9). A leader deciding on a pilot also needs the controls, owners, gates, costs and approvals a company would ask for before saying yes.

## Decision
A separate page, `rfp.html`, linked from Q9. It is a model request for a pilot proposal written from my study. It is not issued by any organisation, names none, and carries placeholders where a company must fill in its own references, dates, names and figures. The main page's Q9 and the technical sections stay as they are, apart from one link.

Contents, in order: document control; executive summary; purpose and background; scope, objectives and acceptance criteria; evidence base; assumptions, constraints and dependencies; requirements (mandatory and desirable, each with a test); pilot plan with phases, gates and decision points; governance and a RACI table; risk register; controls and compliance; cost model; proposer instructions, timetable and evaluation criteria; approvals; appendices (glossary, traceability to the records, benchmarks to collect, change log).

Rules for the figures:
- Every study figure is read from `site/data.json` (already produced by `tools/build_site.py`); no number is typed into the page. No new field is needed.
- Phase lengths, the oversight hours per week and the ratings in the risk register are my assumptions or judgments. The page labels each one as such, and the reader can change the cost inputs.
- The 99% bar, the shadow-mode start, the outcome-based promotion with its minimum call counts, and the automatic switch-off are the study's own rules (ADR 0013, 0016, 0017), restated as requirements, not changed.
- No external accounts-payable benchmark is quoted. The page lists which benchmarks a company should gather from its own records and leaves the fields blank. A sourced figure could be added later, with its source, under a further note.
- Money is in US dollars as in ADR 0019.
- Wording avoids the words in the local term scan.

## Not claimed
- That any approach met the 99% bar, or that a pilot would succeed.
- Any real cost of integration, oversight, a late fix, or a company's own volumes. These are the reader's inputs or blank fields.
- A steady-state saving. The page shows the saving on paper and the pilot cost, and the pilot's cost as a share of the on-paper yearly saving (a gross ceiling, before late-fix costs); it does not estimate what would be earned.
- That the risk ratings are measured. They are my judgment.
- That a value limit would help (ADR 0019 item 6 stands: described, not tested).
- That the page is a legal, audit or procurement-policy document. A company's own process governs.

## Where
`site/rfp.html` and `site/rfp.js`, with a few styles added to `site/style.css`. Q9 gets one link to it.
