# Decision 0008: Use GAS Web App as PM Front Door

## Status

Accepted

## Context

The spreadsheet sidebar helped the prototype move quickly, but it is constrained to a narrow docked surface and keeps PMs too close to operational sheets. The product direction is a comprehensive, user-friendly tool while preserving the current GAS and Google Sheets backend.

## Decision

The primary PM workflow is now a GAS-hosted Web App served by the consolidated Control Center script.

The Control Center spreadsheet remains the system of record and admin/debug surface. The older sidebar and modeless console remain available under `Admin / Debug` as fallback tooling, but normal PM instructions should point to the Communication App URL or `Personal Assistant > Open Communication App`.

CI remains `clasp push` only. Web App deployment/version updates are manual for v1.

## Consequences

- PM-facing documentation centers on the Communication App, not direct spreadsheet tabs.
- The app must be self-sufficient: inbox, active communications, new communication, dashboard signals, history, source/evidence, test Slack status, and live Slack status are visible without opening sheets.
- Existing Apps Script functions, sheets, event keys, skill IDs, Slack commands, and scheduled polling remain stable.
- Future cross-spreadsheet launchers or Workspace Add-ons should open the Web App rather than recreating another spreadsheet-bound console.
