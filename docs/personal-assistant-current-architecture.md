# Personal Assistant Current Architecture

The current Personal Assistant implementation is organized around one clean rule:

```text
Inputs create event-keyed drafts. The Registry decides how those drafts communicate.
```

## System of Record Boundaries

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| Personal Assistant Registry | Event catalog, templates, variables, routing, approval rules, non-secret message policy. | Secrets, queue state, Slack send history. |
| Personal Assistant Hub | Draft queue, review/approval state, send execution, history, run log. | Template text, event definitions, channel policy. |
| Automation Dashboard | Source normalization, snapshots, trigger candidates, dedupe, Hub draft creation attempts. | Stakeholder-facing presentation, message copy. |
| Executive Dashboard | Leadership-friendly presentation. | Automation-friendly schema, communication rules, or bound Apps Script code. |

The Executive Dashboard should not contain our automation code. Owned scripts should live in the Automation Dashboard, Hub, Registry, or optional standalone dashboard adapter, then read the Executive Dashboard by spreadsheet ID.

## Draft Contract

Hub drafts should stay compact:

| Field | Purpose |
| --- | --- |
| `Event Key` | Stable key into the Registry event catalog. |
| `Flow ID` | Stable thread / lifecycle identity for project, incident, release, or story. |
| `Dedupe Key` | Prevents duplicate active drafts for the same observed change. |
| `Payload JSON` | Variables used by the selected template. |

Everything else is review, approval, routing override, Slack metadata, or observability.

## Observability

Traceability is split by layer:

- Automation `Snapshots`: what the meaningful source state looked like when processed, excluding volatile processing fields.
- Automation `Trigger_Log`: why a draft was or was not created.
- Hub `Run_Log`: what the sender did, skipped, or failed.
- Hub `Skill_Run_Log`: atomic skill-level runs, parent runs, input hashes, output summaries, errors, and durations.
- Hub `History`: immutable-ish record of approved/logged/sent communication rows.
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

Use Automation `Config` only for source adapter settings, such as source sheet names and row ranges.

## Current Implementation

The current implementation supports:

- Registry-driven event, template, routing, send-rule, and required-variable lookup.
- Hub queue review, approval, Slack send, History, and Run_Log.
- Automation Dashboard normalization, snapshots, trigger logging, dedupe, and Hub draft creation.
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

Approved sent or log-only communication is treated as verified memory. Drafts are pending memory. Discarded draft content is not promoted to verified memory.

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
