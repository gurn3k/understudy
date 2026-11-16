# 0005. Precision first; trust rule and model rule fixed before any run

## Decision
- Precision comes first. The helper may answer "leave to a person", and a wrong automated action counts as worse than a case left with a person.
- **Trust rule:** a case type is helper-ready only if the lower bound of its 95% Wilson interval for precision is at least 90%. That means at least 35 held-out cases with 0 errors, 53 with 1, 69 with 2, or 84 with 3.
- **Model rule:** the Claude helper ships over the rules baseline only if all three hold:
  1. it makes more case types helper-ready, or covers at least 10 percentage points more held-out cases at the trust bar
  2. no case type's precision drops below the baseline's
  3. every answer is valid JSON
  Ties go to the baseline.

## Alternatives
Optimising accuracy or F1; a plain 90% precision threshold with no interval; picking the better helper after seeing the results.

## Why
An interval stops small case types from passing on luck. Fixing the rule first stops it being tuned to the results.

## Consequences
Some case types will show "not enough evidence". The baseline may win, and the page will say so.
