# Change Proposal 0023: Add Hub Review Sheet

## Problem

The Hub `Queue` is a useful technical ledger, but it is too crowded for manual communication review. Reviewers should not need to touch technical IDs, Slack timestamps, dedupe keys, or payload JSON just to approve a draft.

## Proposal

Keep `Queue` as the source of truth and add a reviewer-facing `Review` sheet.

- `Queue` remains the technical database for drafts, status, Slack metadata, and errors.
- `Review` is rebuilt from active Queue rows.
- Reviewers use the `Decision` column or the `Communication Hub` menu to approve or discard.
- `Approve` updates the matching Queue row and sends/logs through the normal Hub path.
- `Discard` updates the matching Queue row to `Discarded`.

## Expected Impact

- Reviewers see a smaller, decision-oriented surface.
- Approval no longer depends on typing `Approved` into a technical column.
- Queue remains traceable and automation-friendly.

## Risks

`Review` is a generated approval surface, not the source of truth. Manual edits to informational Review columns are overwritten the next time the sheet syncs from Queue.

Google Sheets typed Table columns can reject Apps Script writes on any script-written tab. Keep `Queue`, `Review`, `History`, `Run_Log`, and `Run_Log_Raw` plain/untyped while the Hub is implemented in Sheets.
