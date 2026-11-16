# Research summary (2026-11-15)

## Questions
1. **Who has the pain?** Technology and operations leads choosing a first AI use case. Vendors sell automation rates and simulated savings, but the leads still have to bet on a use case without seeing how it performs on their own cases.
2. **What goes wrong?** Pilots are judged by human agreement with the AI. Reviewers anchor on the suggestion, so agreement inflates and tells you little about accuracy (automation bias).
3. **What already exists?**
   - **UiPath Process Mining:** automation rate (the share of events flagged automated), an "Efficiency – Automation" dashboard ranking activities by lowest automation rate, and an automation-potential simulation of savings and FTE.
   - **Celonis:** process intelligence and digital twins.
   - **BPI Challenge 2019 entries:** compliance, automation and throughput analysis of this same log.
4. **How is Understudy different?** None of these ends with a helper tested on held-out real outcomes, a trust rule per case type, and a rollout design that doesn't rely on human agreement. Sizing is shared ground. The tested decision is the difference.

## Data
- **Source:** BPI Challenge 2019 (van Dongen, 2019), DOI 10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1. Licence CC BY 4.0, with attribution required (ADR 0004).
- **Contents:** about 1.5M purchase-to-pay events from a multinational coatings company, across about 60 subsidiaries.
  - A case is one purchase order *line item*, not a whole order.
  - Each line item follows one of four flows: 3-way match with the invoice after goods receipt, 3-way match with the invoice before goods receipt, 2-way match, or consignment.
  - **Key detail from the source:** in the 3-way, invoice-before-receipt flow, invoices are blocked until goods arrive. Unblocking "can be done by a user, or by a batch process at regular intervals".
  - Each event names its resource, so batch jobs can be told apart from people.

## What the research does not show
- **Effort per step.** The log has timestamps, not handling time, so hours rest on stated assumptions shown as ranges.
- **Whether batch actions were correct.** Batch is not proof of correct.
- **Why a person acted.** There's no free text, only fields and order.

## Sources
- 4TU record: https://data.4tu.nl/articles/_/12715853/1
- UiPath, simulating automation potential: https://docs.uipath.com/process-mining/automation-cloud/latest/user-guide/simulating-automation-potential
- UiPath, P2P automation dashboard: https://docs.uipath.com/process-mining/standalone/2021.10/user-guide/p2p-efficiency-automation
- CKM BPI 2019 report: https://ckmnet-website-blog.s3.amazonaws.com/CKM_BPI_Challenge2019_FINAL+(SUBMIT).pdf
