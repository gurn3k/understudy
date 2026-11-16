# 0017. What the page may claim from the replay and the simulation (decided 2026-11-15 by an independent reviewer)

## Earned autonomy (exact sentences)
- "On outcomes, the fixed rule earned no autonomy. The written policy earned it in two case types: one in week 35 on 896 of 899 correct calls, which was withdrawn in week 43 after 192 of its last 200 were correct, and one in week 46 on 9,112 of 9,185."
- "While autonomous it passed 844 invoices, 15 of them wrong (1.8%, worse than the 99% bar), and removed 788 manual touches."
- "Outcomes arrive weeks after invoices, so most held-out invoices had arrived before the first promotion."

## Agreement gate (replaces the PRD's "promotes sooner and lets more wrong payments through")
- "Simulated: with reviewers copying 9 suggestions in 10, the agreement gate promoted about 10 weeks sooner and passed 19,816 invoices, 150.5 of them wrong (medians of 20 runs; range 114–170), against 844 and 15 on outcomes. That is ten times the wrong payments, at a lower rate per pass (0.76% against 1.8%)."
- "At 0.7 it passed 6,031 with 45.5 wrong (range 0–86), with no earlier promotion; at 0.5 it typically promoted nothing."
- "The agreement it promoted on was mostly copied, so it measured the reviewers, not the helper."

## Don't claim
- That the agreement gate is less accurate or less safe per pass.
- That the outcome gate is safer, or that demotion prevented errors. Demotion ended them after eight weeks.
- That either gate met the 99% bar, or that the replay changes the verdict (ADR 0016).
- Any real-world anchoring rate.
- "Sooner" without stating the copy rate.

## Limits to state
- The window is too short for the outcome lag. The second promotion came in week 46 with few invoices left, so 844 understates steady-state volume.
- The 1.8% rests on 15 errors, mostly from one case type.
- The simulation's low error rate comes from a policy that is about 99% right. On ADR 0014's parameters, a helper wrong 5% of the time would still show about 99.4% agreement at 0.9. This is arithmetic, not a run.
- The simulated gate still demotes on outcomes.
