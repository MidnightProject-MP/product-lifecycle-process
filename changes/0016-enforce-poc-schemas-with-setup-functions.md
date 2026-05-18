# Change Proposal 0016: Enforce POC Schemas with Setup Functions

## Problem

The POC schemas existed as CSV files, but the spreadsheets should be able to create or repair their own tabs and headers through Apps Script setup functions.

## Proposal

Add schema enforcement through Apps Script:

- Hub `setupHubSheets()` creates or repairs the Hub-owned sheets.
- Dashboard `setupDashboardSheet()` was initially used to create or repair `Projects` and `Releases`.
- New Automation Dashboard `setupAutomationSheets()` creates or repairs `Projects_Normalized`, `Gates_Normalized`, `Releases_Normalized`, `Snapshots`, `Trigger_Log`, and `Config`.

Note: Change Proposal 0019 supersedes the original Hub `Templates` / `Config` setup by moving templates, routing, variables, and approval rules into the central Communication Registry.

Note: Change Proposal 0022 supersedes the direct Dashboard setup model. The Executive Dashboard is now treated as a source-only spreadsheet, and the optional dashboard adapter is a standalone script that validates source headers instead of creating or repairing tabs in the Executive Dashboard.

## Expected Impact

- Less manual spreadsheet setup.
- Headers stay aligned with the script expectations.
- The CSV schemas remain documentation/import helpers, while Apps Script becomes the source of enforcement.

## Risks

- Header repair appends unexpected existing headers after required headers rather than deleting them.
- Setup functions do not migrate existing data if columns are manually rearranged in complex ways.

## Adoption Notes

Run the setup function after copying each Apps Script project, and rerun after schema changes.
