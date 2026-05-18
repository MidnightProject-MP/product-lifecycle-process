# Change Proposal 0020: Anchor / Nudge Architecture and clasp Deployment

## Problem

The current POC creates reviewed Slack messages from event-keyed Hub drafts, but the next operating model needs to make Slack itself the executive source of truth. Stakeholders should not have to hunt through threads or spreadsheets to understand the latest state.

The repo also needs repeatable deployment plumbing for each Google Apps Script project instead of manually copying scripts into the Apps Script editor.

## Proposal

Extend the target architecture with:

- Slack Anchor messages that behave like live executive dashboard cards.
- Threaded Slack updates that preserve the detailed audit trail.
- A Thread Map that links each project, incident, release, or stray story to Slack message timestamps.
- A private triage workspace where PMs can respond to nudges, review drafts, and approve publication.
- A design-level Nudge flow that detects stale items and escalates update gaps without inventing status.
- A future `/update` command beside `/incident` for lightweight owner-driven updates.

Add clasp deployment scaffolding:

- One `.clasp.json` per Apps Script folder.
- One `appsscript.json` manifest per Apps Script folder.
- A GitHub Actions workflow that authenticates with `CLASPRC_JSON`, validates GAS folders, and runs `clasp push --force` for configured script IDs.

## Expected Impact

- Executives get a high-signal live Slack feed.
- Engineers and operators retain deep timeline context in threads.
- PMs can provide raw status updates with less reporting friction.
- AI drafting and nudging can be added later without changing the repository boundaries again.
- Apps Script deployments become repeatable from GitHub.

## Risks

- Anchor updates require careful Slack timestamp tracking.
- Nudge logic can become noisy if stale thresholds are too aggressive.
- Placeholder `.clasp.json` files must be replaced with real Apps Script IDs before deployment.
- The GitHub Action depends on a valid `CLASPRC_JSON` secret.

## Adoption Notes

This proposal is design-first for the Anchor/Nudge behavior. It does not add live LLM calls yet.

The deployment workflow skips folders whose `.clasp.json` still contains a `REPLACE_WITH_...` placeholder, so the CI path can exist before all Apps Script IDs are known.
