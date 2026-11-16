# 0007. Data-check window; early events are flagged, not dropped

## Decision
- **Excluded:** events dated outside 2017-01-01 to 2019-12-31, and exact duplicates.
- **Excluded:** cases with no "Create Purchase Order Item" event.
- **Kept and flagged:** events dated before their item's creation.
- **Repeat rate:** published only for change and payment-block activities.

## Alternatives
Drop every event that comes before the item's creation; compute a repeat rate for every activity.

## Why
- **The first scan of the full log (2026-11-15)** found events dated 1948, 1970, 1993, 2001, 2008, 2015 and 2016 next to 1.55M from 2018. Those are bad data.
- **An invoice dated before its order is a known real practice:** buying outside the process, then raising the order afterwards. It's a compliance signal, not a data error.
- **Partial deliveries** make repeated goods receipts and invoices normal.

## Consequences
The window edges are a judgement call, stated on the page. The 223 events from 2017 stay in.
