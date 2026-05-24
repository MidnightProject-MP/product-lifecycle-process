# Personal Assistant Control Center Consolidation

## Target Shape

The future owned operating surface should be one **Personal Assistant Control Center** spreadsheet.

The external Executive Dashboard remains externally owned and presentation-focused. The Control Center owns the automation adapter, Registry, Communication Console state, History, Flow_State, logs, and passive graph memory.

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
| Passive memory | `Graph_Entities`, `Graph_W_Nodes`, `Graph_Edges`, `Graph_Events` |
| Admin/debug only | `Review`, `Flow_Console` during compatibility window |

## Migration Plan

1. Keep the current multi-spreadsheet deployment stable while the Communication Console becomes the only PM workflow.
2. Create a new Control Center spreadsheet from setup functions, with all sheet groups present.
3. Move Registry seed/setup into the Control Center script or make the Control Center script able to repair Registry sheets locally.
4. Move Automation polling into the Control Center script so `Sync Dashboard Now` can call `syncLeadershipDashboardToAutomation` directly.
5. Retire `REGISTRY_SPREADSHEET_ID`, `HUB_SPREADSHEET_ID`, `AUTOMATION_SYNC_WEB_APP_URL`, and the temporary endpoint after cutover.
6. Keep old spreadsheets read-only for one compatibility window, then archive them.

## Launcher Add-on Path

A future Communication Console Launcher Add-on can open the same Console from any authorized spreadsheet. It should pass optional local context:

- spreadsheet ID
- spreadsheet name
- active sheet name
- selected range
- selected row values

The add-on should write all communication drafts to the Control Center, not to the local spreadsheet.

## Out of Scope For Current Phase

- No live spreadsheet merge.
- No Script ID replacement.
- No clasp project merge.
- No add-on implementation.
- No change to the external Executive Dashboard.
