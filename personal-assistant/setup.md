# Personal Assistant Setup

This version uses a cleaner split:

- `Personal Assistant Registry`: central settings, template, event, variable, and approval manager.
- `Personal Assistant Hub`: queue, history, run log, review, approval, and Slack sending.
- `Automation Dashboard`: polling and normalization layer between the leadership dashboard and the Hub.
- `Executive Dashboard`: stakeholder-friendly source dashboard.

Only bootstrap IDs and secrets live in Script Properties. Message policy, templates, channel defaults, variables, and event definitions live in the Registry.

## 1. Create or Identify the Spreadsheets

Create these spreadsheets:

1. `Personal Assistant Registry`
2. `Personal Assistant Hub`
3. `Automation Dashboard`
4. `Executive Dashboard` or your existing leadership dashboard

The setup functions below create and repair the required tabs. The CSV files in `schemas/` remain import helpers and documentation.

Do not bind our automation code to the Executive Dashboard. The Executive Dashboard can be owned by someone else; our scripts should live in owned Apps Script projects and open that sheet by spreadsheet ID.

Design-level schemas for the next Anchor/Nudge pass are also included:

- `thread-map.csv`
- `nudge-log.csv`
- `approval-log.csv`

Spreadsheet convention:

- Row 1 is always the schema header.
- Scripts insert new records at row 2 instead of appending to the bottom.
- Google Sheets Tables are acceptable as long as headers are not renamed and footer rows are not used inside script-managed ranges.
- Normalized refresh tabs may be rewritten from row 2, but scripts should not depend on Table auto-expansion.
- Avoid typed Table columns on script-written tabs: `Queue`, `Review`, `History`, `Run_Log`, `Run_Log_Raw`, and `Skill_Run_Log`. Typed columns can reject Apps Script writes. If you want a polished PM-facing surface, format `Review` as a normal range or protect/hide columns, but do not use typed Table columns while the script rebuilds it from Queue.

## 2. Configure the Personal Assistant Registry

Open the Registry spreadsheet, then go to Extensions > Apps Script.

Create these files and paste the matching code:

- `registry/Config.gs`
- `registry/Code.gs`

Run:

```text
setupRegistrySheets
```

This creates or repairs:

- `Settings`
- `Event_Catalog`
- `Templates`
- `Template_Variables`
- `Event_Transitions`
- `Approval_Rules`

In `Settings`, fill the Slack channel ID values for the active communication types:

| Setting Key | Purpose |
| --- | --- |
| `DEFAULT_PROJECT_CHANNEL` | Project and gate updates. |
| `DEFAULT_INCIDENT_CHANNEL` | Critical issue leadership updates. |
| `DEFAULT_RELEASE_CHANNEL` | Production release updates. |
| `DEFAULT_STRAY_STORY_CHANNEL` | Prioritization / intake updates if enabled. |
| `DEFAULT_LEADERSHIP_CHANNEL` | Executive escalations and postmortems. |

If an older Registry still has a `Routing` tab, `setupRegistrySheets` copies any existing channel IDs into these `Settings` rows and hides the legacy tab.

Do not put Slack tokens, signing secrets, or passwords in the Registry.

## 3. Configure the Personal Assistant Hub Apps Script

Open the Hub spreadsheet, then go to Extensions > Apps Script.

Create these files and paste the matching code:

- `hub/Code.gs`
- `hub/Config.gs`
- `hub/Debug.gs`
- `hub/Flow.gs`
- `hub/FlowConsole.gs`
- `hub/Graph.gs`
- `hub/Queue.gs`
- `hub/ReviewController.gs`
- `hub/ReviewControllerSidebar.html`
- `hub/SkillKernel.gs`
- `hub/Templates.gs`
- `hub/Slack.gs`
- `hub/Webhook.gs`

Script Properties required:

| Property | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot token beginning with `xoxb-`. |
| `REGISTRY_SPREADSHEET_ID` | Spreadsheet ID of the Personal Assistant Registry. |
| `SLACK_VERIFICATION_TOKEN` | Optional Slack slash-command verification token. |

Optional properties:

| Property | Purpose |
| --- | --- |
| `DASHBOARD_SPREADSHEET_ID` | Optional source for the legacy weekly digest helper. |

Run:

```text
setupHubSheets
```

This creates or repairs:

- `Queue`
- `Review`
- `Flow_Console`
- `Flow_State`
- `Graph_Entities`
- `Graph_W_Nodes`
- `Graph_Edges`
- `Graph_Events`
- `History`
- `Run_Log`
- `Skill_Run_Log`

The `Queue` remains the active technical worklist. The `Flow_Console` is the PM-facing surface for selecting a flow, choosing an expected-path or detour action, and creating a draft. The `Review` sheet is the approval surface: it shows draft context, keeps technical Slack/script fields out of the way, and provides a `Decision` dropdown. `Flow_State` stores one parent record per incident, release, project, or other communication flow. `Flow_Console` and `Review` are script-written, so keep them untyped. Completed rows are copied into `History` and removed from `Queue`.

The graph sheets are hidden by default. They are the passive long-term memory layer for Personal Assistant and should not be used as a manual review surface.

`Skill_Run_Log` is hidden by default. It records atomic skill runs, parent run IDs, input hashes, output summaries, errors, and durations so the Hub workflow can be traced below the normal `Run_Log` level.

For Slack lifecycle communications:

- The first sent update for a `Flow ID` creates the parent Slack anchor.
- Later updates with the same `Flow ID` are posted as thread replies.
- The Hub updates the original Slack anchor with the latest executive summary.
- `Event_Transitions` controls next happy-path events and sad-path detours.

If Google Sheets typed columns block writes to `Run_Log`, the Hub writes the same log row to `Run_Log_Raw`. Keep `Run_Log_Raw` as a plain, untyped sheet.

Optional graph export property:

| Property | Purpose |
| --- | --- |
| `GRAPH_EXPORT_FOLDER_ID` | Optional Drive folder ID for manual `graph_data.json` and `calibration_log.json` export. |

Run `exportGraphMemoryToDrive` manually from Apps Script when you want to refresh the JSON memory snapshot. If `GRAPH_EXPORT_FOLDER_ID` is not set, the function logs a skip notice and leaves the hidden graph sheets untouched.

Create an installable trigger:

- Function: `onHubEdit`
- Event source: From spreadsheet
- Event type: On edit

If the trigger arrives without an edit range, the Hub now falls back to scanning the Queue for `Approved` rows and processes them under a lock. This keeps Personal Assistant resilient while you confirm the trigger is configured as `On edit`.

Deploy the Hub script as a Web App:

- Execute as: Me
- Who has access: Anyone with the link, or internal domain if Slack can reach it

Use the Web App URL for Slack slash commands.

## 4. Configure Slack

Create a Slack App with:

- Bot token scopes: `chat:write`, `commands`
- Slash commands: `/incident`, `/release`
- Request URL: Hub Web App URL

Install the app to the workspace and copy the bot token into Hub Script Properties.

## 5. Configure the Automation Dashboard

Open the Automation Dashboard spreadsheet, then go to Extensions > Apps Script.

Create these files and paste the matching code:

- `automation/Code.gs`
- `automation/Config.gs`

Run:

```text
setupAutomationSheets
```

This creates or repairs:

- `Projects_Normalized`
- `Gates_Normalized`
- `Releases_Normalized`
- `Snapshots`
- `Trigger_Log`
- `Config`

In the Automation Dashboard `Config` tab, set:

| Key | Value |
| --- | --- |
| `LEADERSHIP_SPREADSHEET_ID` | Spreadsheet ID of the leadership-facing executive dashboard. |
| `HUB_SPREADSHEET_ID` | Spreadsheet ID of the Personal Assistant Hub. |
| `CREATE_HUB_DRAFTS` | `TRUE` to create Hub drafts from trigger candidates. |
| `PROJECTS_SOURCE_SHEET` | Sheet/tab name containing the project table. |
| `GATES_SOURCE_SHEET` | Sheet/tab name containing the phase gate table. |
| `RELEASES_SOURCE_SHEET` | Sheet/tab name containing the release activity table. |

Configure the source row ranges in the same tab, then run:

```text
syncLeadershipDashboardToAutomation
```

For ongoing polling, create a time-driven trigger for `syncLeadershipDashboardToAutomation`.

## 6. Optional Standalone Dashboard Monitor

The repo still includes `dashboard/Code.gs` and `dashboard/Config.gs` as a simple direct on-edit adapter for testing. Keep this as a standalone Apps Script project that you own; do not create it from inside the Executive Dashboard.

The more robust path is the Automation Dashboard polling flow above because it gives you normalized rows, snapshots, trigger logs, dedupe keys, processing status, and better traceability.

If you use the direct monitor, set these Script Properties in the standalone dashboard adapter:

| Property | Purpose |
| --- | --- |
| `LEADERSHIP_SPREADSHEET_ID` | Spreadsheet ID of the Executive Dashboard to watch. |
| `EXECUTIVE_DASHBOARD_SPREADSHEET_ID` | Accepted fallback name if you prefer this label. |
| `HUB_SPREADSHEET_ID` | Spreadsheet ID of the Personal Assistant Hub. |
| `WRITE_BACK_TO_SOURCE` | Optional. Set to `TRUE` only if the script should write `Last Communication Triggered At` back into the Executive Dashboard. |

Run:

```text
setupDashboardMonitor
```

This validates the expected source tabs and creates an installable `onDashboardEdit` trigger against the Executive Dashboard ID. The trigger runs as the account that created it, and the dashboard owner does not get access to the script unless you explicitly share the Apps Script project.

## 7. Configure clasp Deployment

Each Apps Script folder has a committed `.clasp.json` placeholder and `appsscript.json` manifest:

- `personal-assistant/google-apps-script/hub`
- `personal-assistant/google-apps-script/registry`
- `personal-assistant/google-apps-script/automation`
- `personal-assistant/google-apps-script/dashboard`

Before GitHub Actions can deploy, replace each placeholder `scriptId` with the matching Apps Script project ID:

| Folder | Placeholder |
| --- | --- |
| `hub` | `REPLACE_WITH_HUB_SCRIPT_ID` |
| `registry` | `REPLACE_WITH_REGISTRY_SCRIPT_ID` |
| `automation` | `REPLACE_WITH_AUTOMATION_SCRIPT_ID` |
| `dashboard` | `REPLACE_WITH_DASHBOARD_SCRIPT_ID` |

The GitHub workflow expects one clasp auth repository secret:

| Secret | Purpose |
| --- | --- |
| `CLASPRC_JSON` | Preferred name. Full clasp auth JSON written to `~/.clasprc.json` during deployment. |
| `CLASP_TOKEN` | Accepted fallback name for the same full clasp auth JSON. |

The deployment workflow runs `clasp push --force` only. It does not create Apps Script versions or redeploy web apps.

Folders with placeholder script IDs are skipped so the workflow can exist before every Google-side script ID is known.

## 8. Test Personal Assistant

### Registry Sanity Test

1. Confirm `Event_Catalog` has an active row for the event key you want to test.
2. Confirm that row points to an active `Template Key`.
3. Confirm `Template_Variables` contains the required variables for that template.
4. Confirm `Settings` has the correct `DEFAULT_*_CHANNEL` value for the event channel type.

### Incident Test

1. Run `/incident api outage affecting centers` in Slack.
2. Confirm a `Draft` row appears in Hub `Queue` with `Event Key = incident.critical.identified`.
3. Change `Status` to `Approved`.
4. Confirm Slack receives the message.
5. Confirm `Slack Thread ID`, `Slack Channel`, `Slack Message TS`, `Sent At`, and `Slack Message URL` are populated.

### Project / Release Polling Test

1. Run `syncLeadershipDashboardToAutomation`.
2. Confirm normalized rows appear in the Automation Dashboard.
3. Change a source project or release state in the leadership dashboard.
4. Run `syncLeadershipDashboardToAutomation` again.
5. Confirm `Trigger_Log` records the candidate and a Hub `Queue` draft is created.
6. Approve the Hub row and confirm Slack receives the message.

### Manual Hub Test

For manual review, use the `Review` sheet first. Set `Decision` to `Approve` or `Discard`, or use the `Personal Assistant` menu.

The menu appears after reloading the Hub spreadsheet:

- `Refresh Flow Console`
- `Create draft from Flow Console`
- `Approve selected row(s)`
- `Discard selected row(s)`
- `Refresh Review sheet`
- `Process approved rows`
- `Check Hub configuration`

For direct technical testing, add a `Queue` row with:

- `Source`: `Manual`
- `Lane`: `Project`, `Incident / Bug`, or `Production Release`
- `Event Key`: a key from Registry `Event_Catalog`
- `Status`: `Draft`
- `Priority`
- `Owner`
- `Payload JSON`

Example payload:

```json
{
  "subject": "Claims Modernization",
  "owner": "TPM",
  "what": "Status changed from Green to Red.",
  "so_what": "The next gate and release expectation may change.",
  "whats_next": "PM and TPM will confirm recovery path before the next leadership update."
}
```

Set `Status` to `Approved` to send. If nothing happens, check `Run_Log`.

Debug helper:

```text
debugSendQueueRow
```

Run it manually with a row number in Apps Script if the edit trigger appears to complete silently.

### Hub Smoke Tests

Use these from the Hub Apps Script editor before testing a live Slack post:

```text
debugCheckHubConfiguration
```

Confirms required Script Properties are present and the Hub can reach the Registry.

```text
debugValidateHubRegistryConnection
```

Confirms the Hub can read the Registry event and template for `project.unexpected_status_change`.

```text
debugRunHubSmokeTestLogOnly
```

Creates a row at Queue row 2 and processes it with `Send Rule = Log Only`. Expected result:

- Queue row 2 changes to `Logged`.
- A matching History row appears at row 2.
- Run_Log gets trace rows at row 2.
- No Slack message is sent.

```text
debugRunKernelSmokeTestLogOnly
```

Creates and approves a log-only draft through the atomic skill runner. Expected result:

- The draft is queued through `queue_communication_draft`.
- The draft is approved through `approve_draft`.
- A matching History row appears at row 2.
- Flow_State is updated for the smoke-test `Flow ID`.
- Graph memory has an entity, W-nodes, and graph events for the flow.
- Skill_Run_Log records the parent and child skill runs with no `ERROR` rows for the smoke-test run tree.
- No Slack message is sent.

When the log-only smoke test passes, run:

```text
debugCreateHubSlackSmokeDraft
```

This creates a normal draft at Queue row 2. Change `Status` to `Approved` to test the real Slack send path.

If a trigger does not fire, run:

```text
debugProcessApprovedQueueRows
```

This manually scans the Queue and processes any rows whose `Status` is `Approved`.
