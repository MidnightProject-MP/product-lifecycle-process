# Change Proposal 0032: GAS Web App Communication Console

## Summary

Make a GAS-hosted web app the primary PM experience for Personal Assistant communications while keeping the Control Center spreadsheet as the backend.

## Proposed Change

- Add `doGet` and a full-page Communication App HTML surface to the Control Center Apps Script project.
- Keep the existing spreadsheet sidebar/modal Communication Console as fallback/admin tooling only.
- Expose inbox, active communications, new communication, dashboard signals, and history as first-class app views.
- Reuse existing Control Center behavior for queueing, saving, test sends, approval, discard, history, dashboard sync, and Slack slash commands.
- Add `CONTROL_CENTER_SPREADSHEET_ID`, optional `COMMUNICATION_APP_URL`, and optional `WEB_APP_ALLOWED_EMAILS` setup guidance.

## Expected Impact

PMs no longer need the spreadsheet as the day-to-day interface. The Action Inbox becomes a cleaner front door, the draft detail view shows the flow state and test/live Slack status at a glance, and dashboard sync can be run manually from the same app.

## Risks

- Apps Script deployments still require manual Web App redeploys after web code changes because CI remains push-only.
- Access control depends on Web App deployment settings and, optionally, `WEB_APP_ALLOWED_EMAILS`.
- The first web app version still uses HTML Service and existing server functions, so very large inboxes could require later paging or filtering.
