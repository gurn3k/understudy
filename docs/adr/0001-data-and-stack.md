# 0001. Real public log, no new dependencies

## Decision
Use the BPI Challenge 2019 purchase-to-pay log (CC BY 4.0). Parse it with the Python standard library (streaming XML), and publish a static HTML/JS page. The raw 728 MB file stays outside the synced project folder.

## Alternatives
A synthetic dataset; pandas or pm4py.

## Why
Real data makes every figure checkable. No installs keeps setup and review small.

## Consequences
The parser and the analysis are hand-written, so they need their own tests.
