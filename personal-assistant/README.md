# Personal Assistant

This folder contains the current live Personal Assistant capability: communication automation for projects, incidents, releases, gates, and intake items.

The implementation uses Google Sheets as the operating UI, Apps Script as the orchestrator, and Slack as the executive communication surface.

## Architecture

| Component | Purpose |
| --- | --- |
| Personal Assistant Registry | Central event catalog, templates, variables, approval rules, message behavior, and Slack channel defaults. |
| Personal Assistant Hub | Lean active Queue, Communication Console/Review projection, outbound Slack sender, compact history, flow state, and run log. |
| Automation Dashboard | Owned adapter with raw formula tabs, hidden fast change index, values-only export, circuit breaker, snapshots, observations, trigger logs, dedupe, and Hub draft creation. |
| Executive Dashboard | Presentation-friendly leadership source view, with no bound automation code required. |
| Slack App | Slash command intake and bot-token message delivery. |
| Flow State | Parent state database for Slack anchors, thread timestamps, and next expected lifecycle events. |
| Passive Graph Memory | Hidden W-Graph memory for long-term entity continuity. |
| Skill Kernel | Internal atomic skill runner and trace log for independently callable workflow actions. |

## Contract

Every communication draft is reduced to:

```text
Event Key + Flow ID + Dedupe Key + Payload JSON
```

The Registry resolves the event key into the template, channel type, post mode, send rule, required variables, and approval expectations.

Each draft is also a child update inside a parent `Flow ID`. The first sent update creates the Slack anchor. Subsequent updates reply in the same thread and update the anchor message with the latest executive summary.

PMs should use the Hub `Flow_Console` for manual lifecycle updates. They select the flow, choose a plain-language action such as `Continue expected path` or `Report delay`, answer the three communication prompts, and create a draft for Review.

## Inputs

- Slack `/incident` for critical issue flow starts.
- Future Slack `/update` for owner-provided raw status on an existing entity.
- Automation Dashboard polling for project and release changes.
- Manual review through the Hub `Review` sheet.

## Workflows

### Critical Incidents

```text
/incident in Slack
        |
        v
Hub web app creates Draft with incident.critical.identified
        |
        v
Reviewer approves in Review
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
Trigger_Log records candidates and creates Hub drafts
        |
        v
Reviewer approves in Review
        |
        v
Slack message sends using Registry rules
```

## Files

- `schemas/`: CSV headers and starter rows for the spreadsheets.
- `google-apps-script/registry/`: Apps Script files for the central Registry.
- `google-apps-script/hub/`: Apps Script files for the Personal Assistant Hub.
- `google-apps-script/automation/`: Apps Script files for export validation, shadow polling, evidence, retention, and Hub draft creation.
- `google-apps-script/dashboard/`: Optional standalone direct on-edit adapter that reads the Executive Dashboard by spreadsheet ID.
- Each Apps Script folder includes `.clasp.json` and `appsscript.json` for clasp deployment.
- `schemas/graph-entities.csv`, `schemas/graph-w-nodes.csv`, `schemas/graph-edges.csv`, and `schemas/graph-events.csv`: Passive graph memory schemas.
- `schemas/hub-skill-run-log.csv`: Internal skill execution trace schema.
- `schemas/thread-map.csv`, `schemas/nudge-log.csv`, and `schemas/approval-log.csv`: Design-level schemas for the next Anchor/Nudge architecture.
- `schemas/hub-flow-state.csv` and `schemas/registry-event-transitions.csv`: Parent flow and lifecycle transition schemas.
- `setup.md`: Step-by-step setup guide.
