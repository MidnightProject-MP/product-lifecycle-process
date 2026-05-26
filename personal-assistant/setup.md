# Personal Assistant Setup

New deployments should use the consolidated **Personal Assistant Control Center**. The older split-project setup remains below as fallback while the Control Center is verified.

The Control Center contains:

- local Registry tabs for settings, event catalog, scaffold templates, transitions, and approval rules
- local Hub tabs for Queue, History, Flow_State, fallback Console state, and Slack send metadata
- local Automation tabs for raw dashboard input, values-only export, change index, observations, changes, trigger log, and config
- a GAS-hosted Communication App web page for the PM workflow

The old split version uses:

- `Personal Assistant Registry`: central settings, template, event, variable, and approval manager.
- `Personal Assistant Hub`: queue, history, run log, review, approval, and Slack sending.
- `Automation Dashboard`: polling and normalization layer between the leadership dashboard and the Hub.
- `Executive Dashboard`: stakeholder-friendly source dashboard.

Only secrets and external source IDs live in Script Properties. Message policy, templates, channel defaults, variables, and event definitions live in local Control Center tabs.

## 0. Recommended Clean Control Center Setup

1. Create a new spreadsheet named `Personal Assistant Control Center`.
2. Open Extensions > Apps Script and copy the script ID into `personal-assistant/google-apps-script/control-center/.clasp.json`.
3. Deploy through the normal GitHub Actions clasp workflow, or push the `control-center` folder with clasp manually while bootstrapping.
4. In the Control Center Apps Script editor, run:

```text
setupControlCenter
```

For a clean dev reset with no old data migration, run:

```text
resetControlCenterForDev
```

Required Control Center Script Properties:

| Property | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot token beginning with `xoxb-`. |
| `SLACK_VERIFICATION_TOKEN` | Optional Slack slash-command verification token. |
| `CONTROL_CENTER_SPREADSHEET_ID` | Spreadsheet ID for the Control Center. Recommended for Web App execution; bound spreadsheet fallback is still supported. |

Optional Control Center Script Properties:

| Property | Purpose |
| --- | --- |
| `DASHBOARD_SPREADSHEET_ID` | Optional source for the legacy weekly digest helper. |
| `AUTO_SEND_TEST_ON_QUEUE` | Defaults to `TRUE`. Automatically sends queued drafts to the configured test Slack channel while keeping the draft active for real approval/send. |
| `COMMUNICATION_APP_URL` | Optional Web App URL shown by the spreadsheet menu. If omitted, the script attempts to resolve the current deployment URL. |
| `WEB_APP_ALLOWED_EMAILS` | Optional comma-separated email allowlist for the Communication App. If omitted, access is controlled by the Web App deployment settings. |
| `GEMINI_API_KEY` | Optional Gemini API key for the Communication App copy coach. If omitted, the app falls back to deterministic template scaffolds. |
| `GEMINI_MODEL` | Optional Gemini model override. Defaults to `gemini-2.5-flash`. |

The Control Center no longer needs `REGISTRY_SPREADSHEET_ID`, `HUB_SPREADSHEET_ID`, `AUTOMATION_SYNC_WEB_APP_URL`, or the Console-to-Automation `AUTOMATION_SYNC_TOKEN`.

After setup:

1. Fill `Settings` with `DEFAULT_*_CHANNEL` and `TEST_*_CHANNEL` values.
2. Add formulas or direct connections into `Raw_Executive_Projects` and `Raw_Executive_Releases`.
3. Map those raw tabs into `Automation_Export_Source`.
4. Run `debugValidateAutomationExport`.
5. Run `syncLeadershipDashboardToAutomation`.
6. Deploy the Control Center script as a Web App:
   - Execute as: `Me`
   - Access: your Workspace/domain, or the narrowest access level that works for your PMs
   - Copy the Web App URL into `COMMUNICATION_APP_URL` if the menu cannot resolve it automatically.
7. Use the Web App URL, or `Personal Assistant > Open Communication App`, for PM review, test sends, queueing, manual sync, and live approval.

The Communication App opens as an Action Cockpit. The first screen groups work by PM decision state, such as needs review, ready for live, needs context, failed, scheduled soon, stabilizing, and recent tests. Opening a draft shows a two-column object view with the final title/body editor, actions, readiness checklist, Slack route state, source evidence, and recent history.

If `GEMINI_API_KEY` is configured, Gemini generates an initial editable draft on first open when a Queue item has no saved final message. PMs can also use `AI Re-draft` to tighten their current title/body for Slack formatting. The saved message source of truth is Slack `mrkdwn`; browser HTML is only the editing layer. AI output is never sent automatically; the PM must test or approve the final edited content.

Optional async AI worker:

```text
processPendingCommunicationAiDrafts
```

Install it as a time-driven trigger every 1-5 minutes if you want dashboard-created drafts to be pre-polished before PMs open them. The Web App still has a just-in-time fallback: if a PM opens a draft before the worker processes it, the app generates the AI draft immediately and marks the Queue row complete so the worker will not overwrite it later.

The old sidebar/modal Communication Console remains under `Personal Assistant > Admin / Debug` as a fallback. It is no longer the preferred PM workflow.

Graph memory is intentionally omitted from Control Center v1. The old Hub graph code remains only in the legacy split project.

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
| `TEST_PROJECT_CHANNEL` | Optional sandbox channel for project test sends. Falls back to `DEFAULT_PROJECT_CHANNEL`. |
| `TEST_INCIDENT_CHANNEL` | Optional sandbox channel for incident test sends. Falls back to `DEFAULT_INCIDENT_CHANNEL`. |
| `TEST_RELEASE_CHANNEL` | Optional sandbox channel for release test sends. Falls back to `DEFAULT_RELEASE_CHANNEL`. |
| `TEST_STRAY_STORY_CHANNEL` | Optional sandbox channel for stray story test sends. Falls back to `DEFAULT_STRAY_STORY_CHANNEL`. |
| `TEST_LEADERSHIP_CHANNEL` | Optional sandbox channel for leadership test sends. Falls back to `DEFAULT_LEADERSHIP_CHANNEL`. |

If an older Registry still has a `Routing` tab, `setupRegistrySheets` copies any existing channel IDs into these `Settings` rows and hides the legacy tab.

Run `refreshTemplateScaffolds` if you want to overwrite existing template rows with the current scaffold-style templates. Templates are first-draft structure only; PM-edited title/body content in the Communication App is the final message source.

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
- `hub/TestSlack.gs`
- `hub/Slack.gs`
- `hub/Webhook.gs`

Script Properties required:

| Property | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot token beginning with `xoxb-`. |
| `REGISTRY_SPREADSHEET_ID` | Spreadsheet ID of the Personal Assistant Registry. |
| `SLACK_VERIFICATION_TOKEN` | Optional Slack slash-command verification token. |
| `AUTOMATION_SYNC_WEB_APP_URL` | Optional Automation Dashboard Web App URL used by Communication Console `Sync Dashboard Now`. |
| `AUTOMATION_SYNC_TOKEN` | Optional shared token for Console-triggered dashboard sync. Must match the Automation Script Property. |

Optional properties:

| Property | Purpose |
| --- | --- |
| `DASHBOARD_SPREADSHEET_ID` | Optional source for the legacy weekly digest helper. |
| `AUTO_SEND_TEST_ON_QUEUE` | Defaults to `TRUE`. Automatically sends newly queued drafts to the configured test Slack channel while keeping the draft active for real approval/send. Set to `FALSE` to disable. |
| `ENABLE_PASSIVE_GRAPH_MEMORY` | Defaults to disabled. Set to `TRUE` only if you want the passive graph sheets and graph writes active. |

Run:

```text
setupHubSheets
```

For the v2 dev schema reset, run this first. It clears existing Hub test rows and rebuilds the Hub tabs with the lean v2 headers:

```text
resetHubForV2Dev
```

This creates or repairs:

- `Queue`
- `Review`
- `Flow_Console`
- `Flow_State`
- `History`
- `Run_Log`
- `Skill_Run_Log`

If `ENABLE_PASSIVE_GRAPH_MEMORY` is `TRUE`, setup also creates hidden graph sheets: `Graph_Entities`, `Graph_W_Nodes`, `Graph_Edges`, and `Graph_Events`.

The `Queue` is now a lean active-work table. Draft details that do not need first-class operational columns live in `Payload JSON`. In the legacy split Hub, the Communication Console is the PM-facing fallback for starting a new communication, selecting an existing communication flow, queueing the next expected update or detour, syncing dashboard changes on demand, sending a test to Slack, and approving a draft. New Control Center deployments should use the Web App Communication App instead. `Queue`, `Review`, and `Flow_Console` are internal/admin surfaces and can stay hidden during normal use. `Flow_State` stores one parent record per incident, release, project, or other communication flow. It also keeps parallel test Slack timestamps separate from the live Slack anchor/thread timestamps. `Flow_Console` and `Review` are script-written, so keep them untyped. Completed rows are copied into compact `History` audit rows and removed from `Queue`.

Graph memory is paused by default. It remains available for the broader Personal Assistant roadmap, but it should stay off for the communication workflow until it powers a visible Console, reporting, or guidance feature.

`Skill_Run_Log` is hidden by default. It records atomic skill runs, parent run IDs, input hashes, output summaries, errors, and durations so the Hub workflow can be traced below the normal `Run_Log` level.

For Slack lifecycle communications:

- The first sent update for a `Flow ID` creates the parent Slack anchor.
- Later updates with the same `Flow ID` are posted as compact thread-history replies.
- The Hub updates the original Slack anchor with the latest executive summary.
- Events with `Reply Broadcast = TRUE` use the baseline spotlight model: one full-detail reply is broadcast to the channel, and the previous spotlight reply is deleted so the leadership channel stays one-way and latest-update focused.
- `Event_Transitions` controls next happy-path events and sad-path detours.

If Google Sheets typed columns block writes to `Run_Log`, the Hub writes the same log row to `Run_Log_Raw`. Keep `Run_Log_Raw` as a plain, untyped sheet.

Optional graph export property:

| Property | Purpose |
| --- | --- |
| `GRAPH_EXPORT_FOLDER_ID` | Optional Drive folder ID for manual `graph_data.json` and `calibration_log.json` export. |

Run `exportGraphMemoryToDrive` manually from Apps Script when you want to refresh the JSON memory snapshot. If `ENABLE_PASSIVE_GRAPH_MEMORY` or `GRAPH_EXPORT_FOLDER_ID` is not set, the function logs a skip notice.

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
- `automation/AutomationEndpoint.gs`
- `automation/AutomationUi.gs`
- `automation/AutomationSetup.gs`
- `automation/AutomationExport.gs`
- `automation/AutomationObservation.gs`
- `automation/AutomationRules.gs`
- `automation/AutomationDrafts.gs`
- `automation/AutomationMaintenance.gs`

Run:

```text
setupAutomationSheets
```

This creates or repairs:

- `Raw_Executive_Projects`
- `Raw_Executive_Releases`
- `Automation_Export_Source`
- `Automation_Change_Index` hidden fast preflight sheet
- `Automation_Export`
- `Dashboard_Snapshots`
- `Dashboard_Changes`
- `Dashboard_Observations`
- `Trigger_Log`
- `Config`

In the Automation Dashboard `Config` tab, set:

| Key | Value |
| --- | --- |
| `LEADERSHIP_SPREADSHEET_ID` | Optional legacy value. The v2 path reads the local `Automation_Export_Source` tab. |
| `HUB_SPREADSHEET_ID` | Spreadsheet ID of the Personal Assistant Hub. |
| `CREATE_HUB_DRAFTS` | Keep `FALSE` for shadow polling; set `TRUE` for live Hub draft creation. |
| `MIN_ACTIVE_EXPORT_ROWS` | Minimum active rows required before overwriting `Automation_Export`. |
| `EXPORT_ERROR_SCAN_ROWS` | Number of staging data rows scanned for formula error tokens. |
| `RETENTION_DAYS` | Number of days to keep active snapshot/change rows. |
| `GC_EVERY_N_POLLS` | Poll interval for garbage collection. |
| `POLL_COUNT` | Maintained by the script. |
| `LAST_GC_AT` | Maintained by the script. |
| `FAST_CHANGE_INDEX_ENABLED` | Keep `TRUE` for scheduled polling; set `FALSE` only while debugging full sync. |
| `LAST_CHANGE_INDEX_HASH` | Maintained by the script after successful full sync. |
| `LAST_CHANGE_INDEX_AT` | Maintained by the script after successful full sync. |
| `LAST_FAST_CHECK_AT` | Maintained by the script after no-change fast skips. |
| `LAST_SYNC_MODE` | Maintained by the script as `Full`, `Fast Skip`, or circuit-breaker state. |

Optional Automation Script Properties:

| Property | Purpose |
| --- | --- |
| `AUTOMATION_SYNC_TOKEN` | Shared token required by the internal manual-sync Web App endpoint. Must match the Hub property. |

To enable `Sync Dashboard Now` from the Hub Communication Console, deploy the Automation Dashboard script as a Web App:

- Execute as: Me
- Who has access: Anyone with the link

Copy that Web App URL into Hub Script Properties as `AUTOMATION_SYNC_WEB_APP_URL`. The endpoint only accepts the `sync_dashboard` action and rejects requests without the shared `AUTOMATION_SYNC_TOKEN`.

Add formulas or direct connections into `Raw_Executive_Projects` and `Raw_Executive_Releases`, then map them into `Automation_Export_Source` using the exact export headers. Run:

Keep identity formulas text-safe. Date-like IDs such as `jan-26` should be emitted as text; the script also reads display values and writes `Automation_Export` as plain text to avoid spreadsheet serial-number conversion.

The required export order places `Lead PM` between `Subject` and `Owner`. If you are upgrading an existing `Automation_Export_Source`, insert the `Lead PM` column there and shift the downstream formulas; do not append it to the end.

Optional `Automation_Export_Source` headers may be added after the required export columns:

- `Primary Target`

For project rows where `Next Gate` is `Special Release`, populate `Next Gate ETA` and `Lead PM` when available. The automation will create a single-project release flow using `release.scheduled` and a `rel-special-<source-item-id>` flow ID.

```text
syncLeadershipDashboardToAutomation
```

The first successful run materializes `Automation_Export` as values-only and records baseline observations. Later runs first check `Automation_Change_Index`; when there are no source changes and no pending evaluations, the script exits quickly without writing snapshot/change rows. For ongoing polling, create a time-driven trigger for `syncLeadershipDashboardToAutomation`.

During setup, if you need to clear bad shadow-poll rows from earlier formula or ID tests, run:

```text
resetAutomationShadowEvidenceForDev
```

This clears `Automation_Export`, `Dashboard_Snapshots`, `Dashboard_Changes`, `Dashboard_Observations`, and `Trigger_Log`, resets fast-index status, and leaves `CREATE_HUB_DRAFTS` set to `FALSE`.

## 6. Optional Standalone Dashboard Monitor

The repo still includes `dashboard/Code.gs` and `dashboard/Config.gs` as a simple direct on-edit adapter for testing. Keep this as a standalone Apps Script project that you own; do not create it from inside the Executive Dashboard.

The more robust path is the Automation Dashboard polling flow above because it gives you a values-only export contract, a circuit breaker, snapshots, field-level changes, observations, trigger logs, dedupe keys, processing status, and better traceability.

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

- `personal-assistant/google-apps-script/control-center`
- `personal-assistant/google-apps-script/hub`
- `personal-assistant/google-apps-script/registry`
- `personal-assistant/google-apps-script/automation`
- `personal-assistant/google-apps-script/dashboard`

Before GitHub Actions can deploy, replace each placeholder `scriptId` with the matching Apps Script project ID:

| Folder | Placeholder |
| --- | --- |
| `control-center` | `REPLACE_WITH_CONTROL_CENTER_SCRIPT_ID` |
| `hub` | `REPLACE_WITH_HUB_SCRIPT_ID` |
| `registry` | `REPLACE_WITH_REGISTRY_SCRIPT_ID` |
| `automation` | `REPLACE_WITH_AUTOMATION_SCRIPT_ID` |
| `dashboard` | `REPLACE_WITH_DASHBOARD_SCRIPT_ID` |

The GitHub workflow expects one clasp auth repository secret:

| Secret | Purpose |
| --- | --- |
| `CLASPRC_JSON` | Preferred name. Full clasp auth JSON written to `~/.clasprc.json` during deployment. |
| `CLASP_TOKEN` | Accepted fallback name for the same full clasp auth JSON. |

The deployment workflow runs `clasp push --force` only. It does not create Apps Script versions or redeploy web apps. After changing `doGet`, `CommunicationAppPage.html`, or any server function used by the Web App, manually update the Apps Script Web App deployment to make those changes live at the `/exec` URL.

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
3. Approve the draft from the Communication App, or from `Review` only during technical fallback testing.
4. Confirm Slack receives the message.
5. Confirm compact Slack metadata appears in `History` and parent state appears in `Flow_State`.

### Project / Release Polling Test

1. Confirm `Automation_Export_Source` has valid headers and at least one active Project or Release row.
2. Run `debugValidateAutomationExport`.
3. Run `syncLeadershipDashboardToAutomation`.
4. Confirm `Automation_Export` is values-only and `Dashboard_Observations` has baseline rows.
5. Change a project or release value in the raw/formula mapping.
6. Run `syncLeadershipDashboardToAutomation` again.
7. Confirm `Dashboard_Changes` and `Trigger_Log` record the candidate.
8. With `CREATE_HUB_DRAFTS = FALSE`, confirm no Hub draft is created.
9. Set `CREATE_HUB_DRAFTS = TRUE`, repeat a new material change, then confirm a Hub `Queue` draft appears.
10. Approve the Hub row and confirm Slack receives the message.

### Communication App Test

For manual review, use the Web App URL or `Personal Assistant` > `Open Communication App`. The Communication App is the PM front door. It can start a new communication, continue an existing flow, edit the final title/body, queue a draft, send a test to Slack, approve/send, discard a draft, review dashboard signals, inspect recent history, and run `Sync Dashboard Now` when a PM wants dashboard changes picked up before the next scheduled poll.

The menu appears after reloading the Control Center spreadsheet:

- `Open Communication App`
- `Sync Dashboard Now`
- `Admin / Debug`

The `Admin / Debug` submenu keeps direct sheet operations available for technical troubleshooting, but PMs should not need to use it during normal work.

The fallback sidebar and wide Communication Console remain under `Admin / Debug`. `Queue`, `Review`, and `Flow_Console` are internal operating tabs and can stay hidden during normal use. Test sends use `TEST_*_CHANNEL` when configured and fall back to the current `DEFAULT_*_CHANNEL`, which lets the current sandbox channel remain the test destination until live channel IDs are added. Test Slack timestamps are stored separately from live Slack timestamps in `Queue`, `History`, and `Flow_State`.

For direct technical testing, add a `Queue` row with:

- `Source`: `Manual`
- `Event Key`: a key from Registry `Event_Catalog`
- `Status`: `Draft`
- `Owner`
- `Flow ID`
- `Payload JSON`

Example payload:

```json
{
  "lane": "Project",
  "priority": "Medium",
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

- The Queue row is removed from the active Queue.
- A compact History row appears at row 2 with `Final Status = Logged`.
- Run_Log gets trace rows at row 2.
- No Slack message is sent.

```text
debugRunKernelSmokeTestLogOnly
```

Creates and approves a log-only draft through the atomic skill runner. Expected result:

- The draft is queued through `queue_communication_draft`.
- The draft is approved through `approve_draft`.
- A compact History row appears at row 2 with `Final Status = Logged`.
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
