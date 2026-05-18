# Change Proposal 0022: Keep Executive Dashboard Script External

## Problem

The Executive Dashboard may be owned by a different stakeholder. If our automation script is bound to that spreadsheet, script ownership and visibility can follow the spreadsheet access model instead of staying with the process automation owner.

## Proposal

Treat the Executive Dashboard as a source document only:

- Do not bind automation code to the Executive Dashboard.
- Keep owned code in the Automation Dashboard, Hub, Registry, or optional standalone dashboard adapter.
- Open the Executive Dashboard by spreadsheet ID.
- Prefer time-driven Automation Dashboard polling for production POC behavior.
- If direct on-edit behavior is needed, use a standalone installable trigger created by the script owner.

## Implementation Notes

- The optional dashboard adapter now uses `LEADERSHIP_SPREADSHEET_ID` or `EXECUTIVE_DASHBOARD_SPREADSHEET_ID`.
- `setupDashboardMonitor` validates the source tabs and creates the installable edit trigger.
- The adapter does not write back into the Executive Dashboard unless `WRITE_BACK_TO_SOURCE` is explicitly set to `TRUE`.

## Expected Impact

- The Executive Dashboard owner does not get access to the automation script by owning the sheet.
- The script runs under the account that creates the trigger.
- Presentation ownership and automation ownership stay cleanly separated.

## Risk

The standalone edit trigger still requires the script owner to have appropriate access to the target spreadsheet. If access is read-only or source edits are not reliable enough for direct triggers, use Automation Dashboard polling instead.
