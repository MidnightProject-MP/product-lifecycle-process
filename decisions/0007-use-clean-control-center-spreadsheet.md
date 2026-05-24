# Decision 0007: Use a Clean Control Center Spreadsheet

## Status

Accepted

## Context

The prototype split Personal Assistant across Hub, Registry, and Automation Dashboard spreadsheets. That reduced early risk, but it now creates extra setup, cross-spreadsheet IDs, cache refreshes, a temporary manual-sync endpoint, and a less cohesive PM workflow.

The current sheet data is not valuable enough to migrate.

## Decision

Create a brand-new **Personal Assistant Control Center** spreadsheet and a new bound Apps Script project. The Control Center owns the Communication Console, local Registry tabs, Automation adapter, Queue, History, Flow_State, logs, and live/test Slack metadata.

Old split spreadsheets remain available as fallback until the new Control Center passes a real-data sandbox acceptance test.

Graph memory is omitted from Control Center v1 because it does not currently power a visible communication feature.

## Consequences

- New deployments use one spreadsheet and one Apps Script project.
- The Control Center no longer needs `REGISTRY_SPREADSHEET_ID`, `HUB_SPREADSHEET_ID`, or `AUTOMATION_SYNC_WEB_APP_URL`.
- A new clasp project ID is required before strict validation and deployment can fully include the Control Center.
