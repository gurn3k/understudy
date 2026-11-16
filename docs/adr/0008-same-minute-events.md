# 0008. Same-minute identical events are collapsed, not called errors

## Decision
Within a case, events with the same activity, minute, user and value are collapsed to one event. They're reported as "same-minute identical events collapsed", with counts by activity, not as data errors.

## Alternatives
Keep every copy; drop them as duplicates and call them errors.

## Why
- **The full log (2026-11-15)** has 132,748 such extra events, 8.3% of 1,595,923.
- **91% are "Record Service Entry Sheet"** with no named user (120,846), in runs of up to dozens. The log records time only to the minute, so several real entries in one minute look identical.
- **Activities that matter for candidates** have few: Record Goods Receipt 10,981, Clear Invoice 584, Change Quantity 179, Change Price 23, Remove Payment Block 14.
- **Collapsing is conservative.** It can only lower manual-work and repeat figures, never raise them.

## Consequences
Manual-work counts may be slightly low, and the page says so. The parser's internal name for this check stays `duplicate_events`, but the page and README use the wording above.
