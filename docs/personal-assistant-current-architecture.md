# Personal Assistant Current Architecture

The current Personal Assistant implementation is organized around one clean rule:

```text
Inputs create event-keyed drafts. The Registry decides how those drafts communicate.
```

## System of Record Boundaries

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| Personal Assistant Control Center | Communication App web front door, local Registry tabs, dashboard adapter, draft queue, test send execution, live send execution, compact history, flow state, and run logs. | Stakeholder-facing presentation. |
| Legacy split projects | Existing Hub, Registry, Automation Dashboard, and direct dashboard adapter during fallback. | New PM workflow ownership after Control Center verification. |
| Executive Dashboard | Leadership-friendly presentation. | Automation-friendly schema, communication rules, or bound Apps Script code. |

The Executive Dashboard should not contain our automation code. New owned code should live in the Control Center, then read or import the Executive Dashboard through controlled adapter tabs.

## Draft Contract

Hub v2 drafts stay compact. The Queue is an active-work table, not a send-history table:

| Field | Purpose |
| --- | --- |
| `Event Key` | Stable key into the Registry event catalog. |
| `Flow ID` | Stable thread / lifecycle identity for project, incident, release, or story. |
| `Dedupe Key` | Prevents duplicate active drafts for the same observed change. |
| `Payload JSON` | Variables used by the selected template plus the PM-edited final title/body. |

Queue stores only workflow handles, routing override, send rule, test Slack pointers, payload, and current error state. Draft-specific details such as lane, priority, parent queue, expected previous event, path override, and schedule metadata live inside `Payload JSON`.

## PM Front Door

The GAS-hosted Communication App is the intended PM-facing workflow. PMs start or continue communications, edit the final title/body, send tests to the sandbox Slack channel, queue drafts, approve/send, inspect dashboard signals and history, and run `Sync Dashboard Now` from the app.

The app is now an Action Cockpit rather than a spreadsheet-style review screen. The first screen groups work by decision state: needs review, ready for live, needs context, failed, scheduled soon, stabilizing, and recent tests. Each card explains why it exists and exposes the next PM action. The detail view is an object view: title/body editor and action buttons in the main column, with a readiness checklist, Slack route status, source/evidence summary, flow state, and recent history in the right rail.

When `GEMINI_API_KEY` is configured, the Communication App includes a Gemini copy coach. Gemini can generate an initial editable draft on first PM open when no final saved title/body exists, and can re-draft the PM's current edit for Slack formatting. Templates remain structure/prompt scaffolds only. Slack `mrkdwn` is the saved message source of truth; browser HTML is only a temporary editing/display layer. AI output is not approved or sent by itself; only the draft `mrkdwn` title/body and lightweight AI metadata are stored in `Payload JSON`.

AI draft generation can happen in two ways. The optional `processPendingCommunicationAiDrafts` time-driven worker pre-polishes queued drafts when Apps Script wakes up. If a PM opens a draft first, the Web App uses a just-in-time Gemini call and marks that Queue row complete so the worker will not overwrite the PM-facing draft later.

`Queue`, `Review`, `Flow_Console`, and the older sidebar/modal Communication Console remain for compatibility, observability, and admin/debug recovery. They are hidden or moved under `Admin / Debug` and should not be part of normal PM operation.

## Hub Sheet Roles

| Sheet | Role |
| --- | --- |
| `Queue` | Lean active work state for drafts awaiting review, approval, retry, or scheduled handling. |
| `Review` | Internal readable projection used behind the Communication Console and for admin/debug recovery. |
| `History` | Compact audit of completed, logged, sent, or discarded communication items. |
| `Flow_State` | One parent-flow row per project, incident, release, or story communication thread, with live Slack pointers and parallel test Slack pointers. |
| `Graph_*` | Optional hidden long-term memory for entity/W-node continuity and audit events. Disabled by default. |
| `Run_Log` / `Skill_Run_Log` | Observability only; noisy details are summarized. |

## Observability

Traceability is split by layer:

- Automation `Automation_Export`: last-known-good values-only dashboard contract.
- Automation `Automation_Change_Index`: hidden fast fingerprint used to skip clean no-change polls.
- Automation `Dashboard_Snapshots`: what the export state looked like when processed, excluding volatile processing fields.
- Automation `Dashboard_Changes`: field-level old/new evidence from the last handled observation.
- Automation `Dashboard_Observations`: last successfully handled state per source item.
- Automation `Trigger_Log`: why a draft was or was not created.
- Automation special releases: project rows with `Next Gate = Special Release` create release-style `release.scheduled` flows while preserving source project context in payload memory.
- Hub `Run_Log`: what the sender did, skipped, or failed.
- Hub `Skill_Run_Log`: atomic skill-level runs, parent runs, input hashes, output summaries, errors, and durations.
- Hub `History`: compact audit record with final status, identifiers, live Slack pointers, test Slack pointers, and payload hash.
- Hub graph sheets: optional passive long-term entity, W-node, edge, and graph-event memory.
- Slack metadata: live channel/message/thread/permalink plus separate test channel/message/thread/permalink.

## Spreadsheet Write Convention

Scripts do not append records to the bottom of sheets. Row 1 is the schema header, and every new script-created record is inserted at row 2.

This convention keeps the newest records visible, avoids relying on Google Sheets Table auto-expansion, and allows human-facing tabs to use the Google Sheets Table feature without changing script behavior.

Any code that creates a new row should use the local row-2 insertion helper for its Apps Script project. Bulk refresh tabs, such as normalized automation outputs, may clear and rewrite from row 2, but should not use bottom append behavior.

## Configuration Policy

Use Script Properties only for:

- Secrets, such as `SLACK_BOT_TOKEN`.
- Optional AI configuration, such as `GEMINI_API_KEY` and `GEMINI_MODEL`.
- Bootstrap pointers, such as `REGISTRY_SPREADSHEET_ID`.
- Temporary fallback channel IDs during setup.

Use the Registry for:

- Slack channel routing.
- Scaffold template structure for first drafts.
- Required variables.
- Event-to-template mapping.
- Post mode and send rule.
- Approval expectations.

Use Automation `Config` only for source adapter settings, such as export validation thresholds, shadow/live draft creation, and retention.

## Current Implementation

The current implementation supports:

- Registry-driven event, template, routing, send-rule, and required-variable lookup.
- Hub queue review, automatic/manual test Slack send, approval, live Slack send, History, and Run_Log.
- Automation Dashboard fast no-change detection, export materialization, circuit breaker validation, state anchoring, snapshots, trigger logging, dedupe, and Hub draft creation.
- Manual dashboard sync from the Communication App by directly calling the local dashboard sync function in the Control Center.
- Action Cockpit inbox grouping, readiness panel, source/evidence detail, and Gemini-assisted Slack `mrkdwn` draft polish with deterministic template fallback.
- Slack slash-command intake for `/incident` and `/release`.
- Legacy optional passive W-Graph memory behind the split Hub flow, disabled by default until it powers a visible feature. The consolidated Control Center v1 omits graph sheets.
- Internal atomic skills for draft queueing, review save, approval, discard, template resolution, message rendering, Slack send/update, History, Flow_State, graph memory, graph health, and graph export.

See [Personal Assistant Skills](personal-assistant-skills.md).

## Parent Flow Model

Communication rows are child updates inside a parent flow. A critical incident, production release, or project escalation should have one `Flow ID`, one Slack anchor message, and many possible child updates.

The first approved update creates the anchor. Subsequent updates post compact history replies into the same Slack thread and update the anchor message so Slack remains a live executive dashboard plus a detailed threaded audit trail. High-visibility release and incident updates can also create a latest-only spotlight reply: a full-detail thread reply broadcast to the channel, with the previous spotlight deleted after the new one posts.

See [Hub Flow State](hub-flow-state.md).

## Passive Graph Memory

The legacy split Hub can record communication continuity in hidden graph sheets when `ENABLE_PASSIVE_GRAPH_MEMORY` is set to `TRUE`. `Flow ID` is the v1 graph entity identity. The graph stores entity state, W-node memory, graph edges, and graph events without changing the visible Console, approval, or Slack workflow.

Approved sent or log-only communication is treated as verified memory. Drafts create lightweight pending graph events only. Discarded draft content is not promoted to verified memory.

Graph expansion is paused until it powers a visible app feature, review guidance, or reporting feature. The consolidated Control Center v1 intentionally omits graph sheets and graph writes.

See [Passive Graph Memory](passive-graph-memory.md).

## Cross-Spreadsheet Control

The future cross-spreadsheet control path is a lightweight launcher or Workspace Add-on. It should open the same Communication App from any authorized spreadsheet, pass local spreadsheet context when useful, and write to the central Control Center.

In the consolidated Control Center, the Communication App directly triggers the local dashboard sync. The old token-protected Automation Web App endpoint remains only for the legacy split deployment.

## Next Architecture Extension

The next architecture keeps the same Registry and Hub boundaries, then adds:

- `Thread_Map` as the state database linking each entity to Slack channel and timestamp metadata.
- Slack Anchor messages as editable executive dashboard cards.
- Threaded replies as the detailed communication history.
- Private triage for nudge requests, raw PM replies, AI drafts, and approvals.
- Nudge and escalation logs for stale status governance.
- Future `/update` command support for owner-provided raw updates.

The nudge/escalation layer is design-only in this pass. Gemini is limited to copy coaching for drafts inside the Communication App and does not make communication decisions.
