# Change Proposal 0014: POC Flow IDs, History, Dedupe, and Digest

## Problem

The first POC proved the basic Slack, Hub, and Dashboard paths, but it was missing key workflow mechanics needed to validate the real operating model.

## Proposal

Add:

- Flow IDs to connect related communications.
- Dedupe keys to prevent duplicate drafts.
- A History tab to preserve sent communication records.
- Slack thread lookup by Flow ID.
- Approval timestamps.
- Template send rules.
- Expanded happy-path and sad-path templates.
- Weekly project digest draft generation.
- Dashboard spreadsheet linkage for digest generation.

## Expected Impact

- Incident follow-ups can stay in the original Slack thread.
- The Hub can act as both queue and communication ledger.
- Repeated dashboard edits are less likely to create duplicate drafts.
- Weekly digest becomes a first-class POC workflow.
- Manual Hub entry works alongside Slack and dashboard inputs.

## Risks

- Dedupe keys are simple and may need refinement after real usage.
- Weekly digest formatting is basic and will need tuning.
- History is append-only in spirit, but the POC does not enforce immutability.

## Adoption Notes

Use this version to test the complete operating shape before hardening permissions, request verification, and production-grade routing.

