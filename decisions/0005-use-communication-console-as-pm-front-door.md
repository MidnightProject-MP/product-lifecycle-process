# Decision 0005: Use Communication Console as PM Front Door

## Status

Accepted, superseded by [Decision 0008](0008-use-gas-web-app-as-pm-front-door.md) for new Control Center deployments.

## Context

The Personal Assistant workflow accumulated several user-facing surfaces during the prototype: Queue edits, Review decisions, Flow_Console, dashboard sync menus, and the Communication Console.

That made the system flexible but too technical for PM operation. The product direction is to keep GAS and Sheets, but simplify the user flow.

## Decision

The Communication Console is the only intended PM-facing workflow.

`Queue`, `Review`, and `Flow_Console` remain available for admin/debug recovery and compatibility, but they are hidden by default and are not part of normal PM instructions.

Manual dashboard sync is exposed from the Console through a temporary token-protected Automation endpoint. The endpoint is temporary because the future Control Center consolidation should place Hub and Automation in one owned script.

## Consequences

- PM documentation centers on the Console.
- Normal Hub menus only expose Console open actions; direct sheet operations move under `Admin / Debug`.
- Compatibility wrappers remain so existing triggers and technical tests continue to work.
- The future cross-spreadsheet path should be a launcher add-on that opens the same Console from authorized spreadsheets.
