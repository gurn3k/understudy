# 0017. What the page may claim from the replay and the simulation (decided 2026-11-15 by an independent reviewer)

## Earned autonomy (exact sentences)
- "On outcomes, the fixed rule earned no autonomy. The written policy earned it in two case types: one in week 35 on 896 of 899 correct calls, which was withdrawn in week 43 after 192 of its last 200 were correct, and one in week 46 on 9,112 of 9,185."
- "While autonomous it passed 844 invoices, 15 of them wrong (1.8%, worse than the 99% bar), and removed 788 manual touches."
- "Outcomes arrive weeks after invoices, so most held-out invoices had arrived before the first promotion."

## Agreement gate (replaces the PRD's "promotes sooner and lets more wrong payments through")
- "Simulated: with reviewers copying 9 suggestions in 10, the agreement gate promoted about 10 weeks sooner and passed 19,816 invoices, 150.5 of them wrong (medians of 20 runs; range 114–170), against 844 and 15 on outcomes. That is ten times the wrong payments, at a lower rate per pass (0.74% against 1.8%)."
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

## Erratum (2026-11-16)
The packet behind this ruling misreported the agreement gate's first-promotion weeks. The builder misread a sorted list in which runs with no promotion sorted first. The same reviewer corrected the sentences:
- "Simulated: with reviewers copying 9 suggestions in 10, the agreement gate first promoted about 9 weeks sooner (median week 26 against week 35; range 8–10 weeks across 20 runs) and passed 19,815.5 invoices, 150.5 of them wrong (medians of 20 runs; range 114–170), against 844 and 15 on outcomes. That is ten times the wrong payments, at a lower rate per pass (0.74% against 1.8%)."
- "At 0.7 it promoted in 17 of 20 runs, the earliest in week 26, and passed 6,031.5 invoices, 45.5 of them wrong (medians of 20 runs; range 0–86). At 0.5 it promoted in 1 of 20 runs."

These replace the 0.9 and 0.7/0.5 sentences above. "No earlier promotion" at 0.7, "6,031" and "about 10 weeks" (that was the example run, not the median) were wrong.

## Erratum 2 (2026-11-16)
The touches figure counted every manual Clear Invoice and Remove Payment Block event on the order line, including clearings of later invoices the policy never judged. ADR 0013 counts the events on the passed invoice. Counted from the first invoice receipt to its clearing, the figure is 785, not 788. Three later clearings on three order lines were removed. The corrected sentence:
- "While autonomous it passed 844 invoices, 15 of them wrong (1.8%, worse than the 99% bar), and removed 785 manual touches."

This replaces the 788 sentence above. No other figure changes.

## Erratum 3 (2026-11-21)
The agreement gate's rate per pass in the sentences above first read 0.76%. That divided the median wrong (150.5) by the median paid (19,815.5), and those medians come from different runs, so their ratio is not a rate (ADR 0022). The rate is now pooled over all 20 runs: every line needing a correction over every line paid, 0.7379%, shown as 0.74%. That is the figure the page uses in its text and its tables. No other figure changes.
