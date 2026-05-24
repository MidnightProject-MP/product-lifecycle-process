# Personal Assistant Control Center Consolidation

## Current Target Shape

The owned operating surface for new deployments is one **Personal Assistant Control Center** spreadsheet.

The external Executive Dashboard remains externally owned and presentation-focused. The Control Center owns the automation adapter, Registry, Communication Console state, History, Flow_State, logs, and live/test Slack metadata.

## Why Consolidate

Current owned workbooks are split into Registry, Hub, and Automation Dashboard. That separation helped the prototype evolve safely, but it now creates setup friction, cross-spreadsheet IDs, cache refresh steps, and a temporary web endpoint for manual sync.

One owned Control Center would remove most bootstrap pointers and make the PM workflow feel like one product instead of several spreadsheets stitched together.

## Proposed Sheet Groups

| Group | Sheets |
| --- | --- |
| Console operations | `Queue`, `History`, `Flow_State` |
| Registry | `Settings`, `Event_Catalog`, `Templates`, `Template_Variables`, `Event_Transitions`, `Approval_Rules` |
| Automation adapter | `Raw_Executive_Projects`, `Raw_Executive_Releases`, `Automation_Export_Source`, `Automation_Change_Index`, `Automation_Export`, `Dashboard_Observations`, `Dashboard_Changes`, `Dashboard_Snapshots`, `Trigger_Log`, `Config` |
| Observability | `Run_Log`, `Skill_Run_Log` |
| Admin/debug only | `Review`, `Flow_Console` during compatibility window |

## Migration Plan

1. Create a new Control Center spreadsheet and bound Apps Script project.
2. Fill `control-center/.clasp.json` with the new script ID.
3. Deploy the new `control-center` project while keeping the old split projects available.
4. Run `setupControlCenter` or `resetControlCenterForDev`.
5. Configure local `Settings`, raw dashboard formulas, and scheduled polling.
6. Run one sandbox acceptance test, then archive or make the old split spreadsheets read-only.

The new Control Center retires `REGISTRY_SPREADSHEET_ID`, `HUB_SPREADSHEET_ID`, `AUTOMATION_SYNC_WEB_APP_URL`, and the Console-to-Automation `AUTOMATION_SYNC_TOKEN`.

## Launcher Add-on Path

A future Communication Console Launcher Add-on can open the same Console from any authorized spreadsheet. It should pass optional local context:

- spreadsheet ID
- spreadsheet name
- active sheet name
- selected range
- selected row values

The add-on should write all communication drafts to the Control Center, not to the local spreadsheet.

## Out of Scope For Control Center v1

- No old data migration.
- No add-on implementation.
- No change to the external Executive Dashboard.
- No graph memory sheets or graph recording.
