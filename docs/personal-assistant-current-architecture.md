# Personal Assistant Current Architecture

The current Personal Assistant implementation is organized around one clean rule:

```text
Inputs create event-keyed drafts. The Registry decides how those drafts communicate.
```

## System of Record Boundaries

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| Personal Assistant Registry | Event catalog, templates, variables, routing, approval rules, non-secret message policy. | Secrets, queue state, Slack send history. |
| Personal Assistant Hub | Draft queue, PM review projection, send execution, compact history, flow state, run log. | Template text, event definitions, channel policy. |
| Automation Dashboard | Owned source adapter, values-only export, snapshots, observations, trigger candidates, dedupe, Hub draft creation attempts. | Stakeholder-facing presentation, message copy. |
| Executive Dashboard | Leadership-friendly presentation. | Automation-friendly schema, communication rules, or bound Apps Script code. |

The Executive Dashboard should not contain our automation code. Owned scripts should live in the Automation Dashboard, Hub, Registry, or optional standalone dashboard adapter, then read the Executive Dashboard by spreadsheet ID.

## Draft Contract

Hub v2 drafts stay compact. The Queue is an active-work table, not a send-history table:

| Field | Purpose |
| --- | --- |
| `Event Key` | Stable key into the Registry event catalog. |
| `Flow ID` | Stable thread / lifecycle identity for project, incident, release, or story. |
| `Dedupe Key` | Prevents duplicate active drafts for the same observed change. |
| `Payload JSON` | Variables used by the selected template. |

Queue stores only workflow handles, routing override, send rule, payload, and current error state. Draft-specific details such as lane, priority, parent queue, expected previous event, path override, and schedule metadata live inside `Payload JSON`.

## Hub Sheet Roles

| Sheet | Role |
| --- | --- |
| `Queue` | Lean active work state for drafts awaiting review, approval, retry, or scheduled handling. |
| `Review` | Readable PM-facing projection used by the Communication Console and manual review. |
| `History` | Compact audit of completed, logged, sent, or discarded communication items. |
| `Flow_State` | One live parent-flow row per project, incident, release, or story communication thread. |
| `Graph_*` | Hidden long-term memory for entity/W-node continuity and audit events. |
| `Run_Log` / `Skill_Run_Log` | Observability only; noisy details are summarized. |

## Observability

Traceability is split by layer:

- Automation `Automation_Export`: last-known-good values-only dashboard contract.
- Automation `Dashboard_Snapshots`: what the export state looked like when processed, excluding volatile processing fields.
- Automation `Dashboard_Changes`: field-level old/new evidence from the last handled observation.
- Automation `Dashboard_Observations`: last successfully handled state per source item.
- Automation `Trigger_Log`: why a draft was or was not created.
- Hub `Run_Log`: what the sender did, skipped, or failed.
- Hub `Skill_Run_Log`: atomic skill-level runs, parent runs, input hashes, output summaries, errors, and durations.
- Hub `History`: compact audit record with final status, identifiers, Slack pointers, and payload hash.
- Hub graph sheets: passive long-term entity, W-node, edge, and graph-event memory.
- Slack metadata: channel, message timestamp, thread ID, and permalink.

## Spreadsheet Write Convention

Scripts do not append records to the bottom of sheets. Row 1 is the schema header, and every new script-created record is inserted at row 2.

This convention keeps the newest records visible, avoids relying on Google Sheets Table auto-expansion, and allows human-facing tabs to use the Google Sheets Table feature without changing script behavior.

Any code that creates a new row should use the local row-2 insertion helper for its Apps Script project. Bulk refresh tabs, such as normalized automation outputs, may clear and rewrite from row 2, but should not use bottom append behavior.

## Configuration Policy

Use Script Properties only for:

- Secrets, such as `SLACK_BOT_TOKEN`.
- Bootstrap pointers, such as `REGISTRY_SPREADSHEET_ID`.
- Temporary fallback channel IDs during setup.

Use the Registry for:

- Slack channel routing.
- Template copy.
- Required variables.
- Event-to-template mapping.
- Post mode and send rule.
- Approval expectations.

Use Automation `Config` only for source adapter settings, such as export validation thresholds, shadow/live draft creation, and retention.

## Current Implementation

The current implementation supports:

- Registry-driven event, template, routing, send-rule, and required-variable lookup.
- Hub queue review, approval, Slack send, History, and Run_Log.
- Automation Dashboard export materialization, circuit breaker validation, state anchoring, snapshots, trigger logging, dedupe, and Hub draft creation.
- Slack slash-command intake for `/incident` and `/release`.
- Passive W-Graph memory behind the existing communication flow.
- Internal atomic skills for draft queueing, review save, approval, discard, template resolution, message rendering, Slack send/update, History, Flow_State, graph memory, graph health, and graph export.

See [Personal Assistant Skills](personal-assistant-skills.md).

## Parent Flow Model

Communication rows are child updates inside a parent flow. A critical incident, production release, or project escalation should have one `Flow ID`, one Slack anchor message, and many possible child updates.

The first approved update creates the anchor. Subsequent updates should post into the same Slack thread and update the anchor message so Slack remains a live executive dashboard plus a detailed threaded audit trail.

See [Hub Flow State](hub-flow-state.md).

## Passive Graph Memory

The Hub records communication continuity in hidden graph sheets. `Flow ID` is the v1 graph entity identity. The graph stores entity state, W-node memory, graph edges, and graph events without changing the visible Review, approval, or Slack workflow.

Approved sent or log-only communication is treated as verified memory. Drafts create lightweight pending graph events only. Discarded draft content is not promoted to verified memory.

See [Passive Graph Memory](passive-graph-memory.md).

## Next Architecture Extension

The next architecture keeps the same Registry and Hub boundaries, then adds:

- `Thread_Map` as the state database linking each entity to Slack channel and timestamp metadata.
- Slack Anchor messages as editable executive dashboard cards.
- Threaded replies as the detailed communication history.
- Private triage for nudge requests, raw PM replies, AI drafts, and approvals.
- Nudge and escalation logs for stale status governance.
- Future `/update` command support for owner-provided raw updates.

The LLM/Nudge layer is design-only in this pass. No live Gemini or other LLM calls are part of the current implementation.
