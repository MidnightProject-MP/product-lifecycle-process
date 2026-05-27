# Personal Assistant Skills

Personal Assistant treats each meaningful action as an independently callable skill.

In this phase, skills are internal Apps Script calls only. There is no public skill endpoint. Existing behavior remains stable: Control Center sheets, Communication App, fallback Communication Console, Registry tabs, Slack anchors, Slack threads, slash commands, and triggers continue to behave as before.

The long-term skill direction is defined in [Personal Assistant North Star](personal-assistant-north-star.md). Future storage, embedding, graph, connector, normalization, reconciliation, and reasoning skills should use that document as their planning anchor, but they are not implemented here unless listed as current below.

## Skill Kernel

The Hub owns the skill runner in `SkillKernel.gs`.

```javascript
runSkill(skillId, input, options)
```

Every skill returns the same envelope:

```json
{
  "ok": true,
  "skillId": "approve_draft",
  "runId": "uuid",
  "startedAt": "timestamp",
  "completedAt": "timestamp",
  "output": {},
  "error": null
}
```

Skill runs are logged in the hidden `Skill_Run_Log` sheet. This gives each internal action a traceable run ID, parent run ID, input hash, output summary, error, and duration.

## Core Communication Skills

| Skill | Purpose | Reads | Writes / Side Effects | Approval | Idempotency | Failure Behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `queue_communication_draft` | Create or dedupe a communication draft. | Registry indirectly through queue normalization. | Lean `Queue`, `Review`, lightweight graph event. | No. | Uses `Dedupe Key` to avoid duplicate active drafts. | Fails if event key cannot be resolved. |
| `save_review_draft` | Save Communication Console edits back to the Queue payload. | `Queue`, selected Review/Queue row. | `Queue`, `Review`, lightweight graph event. | No. | Updates the selected draft in place. | Fails if the Queue row no longer exists. |
| `approve_draft` | Approve and process a Queue draft. | `Queue`, Registry, Flow_State, Slack config. | Slack, `Queue`, compact `History`, `Flow_State`, `Review`, graph verified memory, possibly next scheduled draft. | Yes, human-driven. | Existing flow sequence checks prevent stale drafts from moving silently. | If send fails, Queue row moves to `Error`; the skill returns failure. |
| `discard_draft` | Archive and remove an active draft. | `Queue`. | Compact `History`, `Queue`, `Review`, graph discard event. | Yes, human-driven. | Removes the active row once archived. | Fails if the Queue row is missing. |
| `resolve_template_policy` | Resolve event/template/routing behavior from the Registry. | Registry `Event_Catalog`, `Templates`, `Settings`. | None. | No. | Read-only. | Fails if event or template is missing/inactive. |
| `validate_template_variables` | Validate required template variables. | Registry `Template_Variables`, Queue payload. | None. | No. | Read-only. | Fails with the missing variables list. |
| `render_anchor_message` | Render the Slack anchor message text. | Registry template, Queue payload. | None. | No. | Pure render. | Returns empty text if template/payload render empty. |
| `render_thread_reply` | Render the Slack thread-history reply text. | Registry template, Queue payload, Flow_State. | None. | No. | Pure render with fallback history text. | Returns empty text if template and fallback data are empty. |
| `resolve_slack_target` | Resolve Slack channel, thread timestamp, and reply policy. | Registry Settings, Flow_State, History fallback. | None. | No. | Read-only. | Fails if no channel is configured. |
| `post_slack_message` | Post a Slack message or thread reply. | Hub Script Properties. | Slack `chat.postMessage`. | Requires prior approval when called by workflow. | Not idempotent by itself. Callers own dedupe. | Fails on Slack API errors. |
| `send_test_slack_message` | Post a Queue draft to the configured test Slack channel without consuming the Queue row. | `Queue`, Registry Settings, Flow_State test pointers, Hub Script Properties. | Slack `chat.postMessage`, optional test anchor update, `Queue` test Slack fields, `Flow_State` test Slack fields, `Review`. | No; intended for sandbox proofing. | Not idempotent by itself; each click sends a new test message. | Fails on Slack API errors for manual test sends; automatic test sends log warnings and keep the Queue draft active. |
| `update_slack_anchor` | Update the parent Slack anchor when policy allows. | Flow_State, Registry template policy. | Slack `chat.update`. | Requires prior approval when called by workflow. | Updates existing anchor timestamp. | Best-effort in the workflow; thread reply remains the audit record. |
| `record_history` | Write a compact audit row for a completed Queue item. | Completion item, `Queue`. | `History`. | No. | One row per workflow completion. | Fails if the Queue row cannot be found. |
| `advance_flow_state` | Move the parent communication flow forward. | Registry transitions, Queue payload, previous Flow_State. | `Flow_State`, optional graph flow sync. | No. | Upserts by `Flow ID`. | Fails if Registry transition logic cannot be read. |
| `schedule_next_flow_draft` | Queue the next happy-path draft when Registry rules allow. | Registry `Event_Transitions`, `Queue`. | `Queue`, `Review`, lightweight graph event. | No. | Uses flow-next dedupe key. | Best-effort after successful send/log. |

## Trust Layer Skills

| Skill | Purpose | Reads | Writes / Side Effects | Approval | Idempotency | Failure Behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `append_unified_event` | Append a normalized evidence/event record to the locked trust ledger. | `Unified_Event_Log`. | `Unified_Event_Log`. | No. | Uses `LockService` and event/source/locator/hash correlation to skip duplicates. | Fails if the script lock cannot be acquired. |
| `sensor_slack_scan_delta` | Process raw non-command Slack payloads into normalized source events. | `Slack_Inbox_Raw`. | `Slack_Inbox_Raw`, `Unified_Event_Log`. | No. | Raw rows are marked processed or duplicate after ledger append. | Marks the raw row `Error` and continues. |
| `run_essential_milestone_audit` | Audit one known milestone/date against narrowed source evidence. | Provided source text and known official state. | `Unified_Event_Log`; optionally calls Gemini. | No. | Result event dedupes through `append_unified_event`. | Returns `INSUFFICIENT_EVIDENCE` without Gemini when no candidate text exists; invalid drift evidence is downgraded. |
| `reconcile_alignment_events` | Convert pending audit evidence into PM-reviewable Alignment Risks. | `Unified_Event_Log`, `Alignment_Risks`, `Automation_Export`. | `Alignment_Risks`, `Unified_Event_Log`. | No. | One open risk per stable entity/risk/evidence hash. | Marks failed evidence events `Error`; does not send Slack. |
| `rollup_project_history` | Summarize processed evidence events and prune safe raw rows. | `Unified_Event_Log`. | `Project_History`, `Unified_Event_Log`. | No. | Rolled-up rows are marked before pruning. | Never prunes unresolved, errored, or unprocessed events. |

## Graph Memory Skills

| Skill | Purpose | Reads | Writes / Side Effects | Approval | Idempotency | Failure Behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `record_graph_memory` | Record draft, send/log, discard, or flow-state graph observations when graph memory is enabled. | Queue item or Flow_State input. | Hidden graph sheets if `ENABLE_PASSIVE_GRAPH_MEMORY = TRUE`. | No. | Drafts append lightweight events; approved send/log upserts verified W-node memory. | Returns a skipped result when graph memory is disabled; best-effort callers do not block communication. |
| `export_graph_memory_snapshot` | Export graph memory JSON files to Drive. | Hidden graph sheets, optional `GRAPH_EXPORT_FOLDER_ID`. | `graph_data.json`, `calibration_log.json` if graph memory and folder export are configured. | Manual/debug. | Rewrites snapshot files. | Logs and skips export when graph memory or folder ID is missing. |
| `resolve_graph_context` | Load graph context for a flow. | Hidden graph sheets. | None. | No. | Read-only. | Fails if `flowId` is missing. |
| `analyze_review_completeness` | Check a draft against W-memory completeness. | Queue payload, graph context. | None. | No. | Read-only advisory. | Returns warnings; does not block approval. |
| `build_review_guidance` | Build human-readable review guidance from graph context. | Queue payload, graph context. | None. | No. | Read-only advisory. | Advisory only; no Slack or approval behavior changes. |
| `check_graph_health` | Inspect graph integrity. | Hidden graph sheets. | None. | Manual/debug. | Read-only. | Reports orphan/incomplete counts. |
| `backfill_graph_from_history` | Rebuild graph memory from existing History and Flow_State. | `History`, `Flow_State`. | Hidden graph sheets. | Manual/debug. | Upsert-based and safe to rerun. | Logs graph warnings but does not change Slack/Queue. |

## Current Public Wrappers

These existing Apps Script entrypoints remain stable and delegate into skills:

- `onHubEdit`
- `approveSelectedQueueRows`
- `discardSelectedQueueRows`
- `saveReviewControllerDraft`
- `approveReviewControllerDraft`
- `discardReviewControllerDraft`
- Slack slash command handlers
- Debug helpers
- Setup functions

## Out of Scope

These are still future architecture items, not implemented skills yet:

- Public Web App skill endpoint
- Storage, embedding, broad source connector, graph backbone, and reasoning skills from the north-star architecture
- Broad LLM reasoning calls outside the current Gemini copy coach
- BYOK/local AI
- Gmail/Calendar ingestion
- Full Google Docs artifact crawling beyond targeted milestone-audit input
- Jira/Linear sync
- Proactive nudges
- Morning brief
- Slack approval buttons
