# 0009. Invoice triage: target and labels

## Decision
- **Decision point:** the first "Record Invoice Receipt" on an item.
- **Label "straight through":** the item reaches its first "Clear Invoice" with no corrective activity between the first invoice receipt and that clearing.
- **Corrective activities:**
  - any activity starting "Change " or "Cancel "
  - Vendor creates debit memo
  - Set Payment Block
  - Block Purchase Order Item
  - Delete Purchase Order Item
  - Reactivate Purchase Order Item
- **Not corrective:** a routine Remove Payment Block, a goods receipt, or a further invoice.
- **Unlabelled, and counted with a reason:**
  - no invoice receipt
  - no clearing after the invoice (not finished)
  - created outside the fitting or held-out months
- **Facts the helper may use** are only those known at the decision point:
  - the item's fields
  - its value
  - whether goods were received before the invoice
  - corrections before the invoice
  - whether the invoice predates the item
  - rates fitted on the earlier months only, such as a vendor's past share of straight-through invoices
- **Precision is the precision of "straight through" calls.** A wrong straight-through call means an invoice paid that needed correcting.

## Alternatives
Count a manual Remove Payment Block as an exception; label every case, including unfinished ones.

## Why
Removing the block is the normal step in the invoice-before-goods flow. Unfinished cases have unknown outcomes.

## Consequences
Unfinished items are left out, and the page shows how many.
