# Personal Assistant

This folder contains the current live Personal Assistant capability: communication automation for projects, incidents, releases, gates, and intake items.

The implementation uses Google Sheets as the operating UI, Apps Script as the orchestrator, and Slack as the executive communication surface.

## Architecture

| Component | Purpose |
| --- | --- |
| Personal Assistant Control Center | Consolidated spreadsheet and Apps Script project with the Communication App web front door, local Registry tabs, Automation adapter, Queue, History, Flow_State, live/test Slack sender, and observability. |
| Legacy split projects | Existing Hub, Registry, Automation Dashboard, and dashboard adapter remain available as fallback during cutover. |
| Executive Dashboard | Presentation-friendly leadership source view, with no bound automation code required. |
| Slack App | Slash command intake and bot-token message delivery. |
| Flow State | Parent state database for live Slack anchors, test Slack anchors, thread timestamps, and next expected lifecycle events. |
| Passive Graph Memory | Optional hidden W-Graph memory for long-term entity continuity. Disabled by default for the communication workflow. |
| Skill Kernel | Internal atomic skill runner and trace log for independently callable workflow actions. |

## Contract

Every communication draft is reduced to:

```text
Event Key + Flow ID + Dedupe Key + Payload JSON
```

The Registry resolves the event key into the scaffold template, channel type, post mode, send rule, required variables, and approval expectations. Templates generate an editable first draft only; PM-edited title/body fields in the Communication App become the final Slack message.

Each draft is also a child update inside a parent `Flow ID`. The first sent update creates the Slack anchor. Subsequent updates reply in the same thread and update the anchor message with the latest executive summary.

PMs should use the GAS-hosted Communication App for normal work. The spreadsheet remains the backend/control layer. From the app, PMs can open the Action Cockpit, review dashboard signals, select an existing communication or start a new one, edit the final title/body, send tests to the sandbox Slack channel, queue a draft, and approve/send without working directly in spreadsheet tabs.

The Action Cockpit groups work by PM decision state and gives each card one obvious next action. Draft detail pages show the final editor beside readiness, Slack route state, source evidence, flow state, and history. If configured with `GEMINI_API_KEY`, Gemini provides optional copy coaching for initial drafts and AI re-drafts. Slack `mrkdwn` is the saved source of truth; HTML is only the browser editor layer. PMs still explicitly test and approve all final messages.

## Inputs

- Slack `/incident` for critical issue flow starts.
- Future Slack `/update` for owner-provided raw status on an existing entity.
- Control Center polling for project, release, and project-originated special release changes.
- Manual review, test send, and live send through the Communication App.

## Workflows

### Critical Incidents

```text
/incident in Slack
        |
        v
Hub web app creates Draft with incident.critical.identified
        |
        v
Reviewer approves in the Communication App
        |
        v
Hub resolves template and channel settings from Registry
        |
        v
Slack post is sent and thread metadata is stored
```

### Projects and Releases

```text
Leadership dashboard changes
        |
        v
Automation Dashboard formulas map into Automation_Export_Source
        |
        v
Fast change index skips clean no-change polls
        |
        v
Apps Script validates and materializes Automation_Export
        |
        v
Snapshots and observations compare current state to last handled state
        |
        v
Trigger_Log records candidates and creates Hub drafts, including release-style special release drafts from project rows
        |
        v
Reviewer approves in the Communication App
        |
        v
Slack message sends using Registry rules
```

## Files

- `schemas/`: CSV headers and starter rows for the spreadsheets.
- `google-apps-script/control-center/`: New consolidated Apps Script project for fresh Control Center deployments.
- `google-apps-script/registry/`: Legacy split Apps Script files for the central Registry.
- `google-apps-script/hub/`: Legacy split Apps Script files for the Personal Assistant Hub.
- `google-apps-script/automation/`: Legacy split Apps Script files for export validation, shadow polling, evidence, retention, and Hub draft creation.
- `google-apps-script/dashboard/`: Optional standalone direct on-edit adapter that reads the Executive Dashboard by spreadsheet ID.
- Each Apps Script folder includes `.clasp.json` and `appsscript.json` for clasp deployment.
- `schemas/graph-entities.csv`, `schemas/graph-w-nodes.csv`, `schemas/graph-edges.csv`, and `schemas/graph-events.csv`: Passive graph memory schemas.
- `schemas/hub-skill-run-log.csv`: Internal skill execution trace schema.
- `schemas/thread-map.csv`, `schemas/nudge-log.csv`, and `schemas/approval-log.csv`: Design-level schemas for the next Anchor/Nudge architecture.
- `schemas/hub-flow-state.csv` and `schemas/registry-event-transitions.csv`: Parent flow and lifecycle transition schemas.
- `setup.md`: Step-by-step setup guide.
