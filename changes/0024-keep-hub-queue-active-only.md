# Change Proposal 0024: Keep Hub Queue Active-Only

## Problem

`Queue` and `History` were starting to overlap. Completed rows stayed in Queue after being sent or logged, which made Queue look like both a worklist and an archive.

## Proposal

Make `Queue` active-only:

- `Queue` holds rows that still need action: `Draft`, `Approved`, or `Error`.
- `Review` is generated from active Queue rows.
- `History` receives completed outcomes: `Sent`, `Logged`, and `Discarded`.
- Completed rows are removed from Queue after they are archived to History.

## Expected Impact

- Queue stays short and operational.
- Review only shows work that needs attention.
- History becomes the durable communication archive.

## Risk

Anyone looking for a completed item must use `History`, not Queue.
