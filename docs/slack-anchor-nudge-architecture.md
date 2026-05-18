# Slack Anchor and Nudge Architecture

This is the next target state after the current Personal Assistant Registry + Hub + Automation Dashboard implementation.

## Core Idea

Slack becomes the executive source of truth through editable Anchor messages. Each anchor represents the latest known state of a project, critical issue, release, or other tracked entity.

Threads remain the detailed timeline. The parent Anchor gives executives the answer now; replies give operators and engineers the history.

```text
Source update or Slack command
        |
        v
Hub creates or updates draft state
        |
        v
AI or template layer drafts business-impact language
        |
        v
Owner approves in private triage
        |
        v
Public Slack thread receives detailed update
        |
        v
Public Slack Anchor is updated with latest state
```

## Slack Surfaces

| Surface | Purpose |
| --- | --- |
| Public executive channel | High-signal Anchor messages and approved updates. |
| Public thread | Chronological detail, technical context, release notes, and audit history. |
| Private triage channel | Nudge requests, raw PM replies, AI drafts, and approvals. |
| Hub spreadsheet | Queue, history, observability, and fallback manual control. |

## Anchor Message

An Anchor is the parent Slack message for a tracked entity.

It should show:

- Entity name and type.
- Current phase or status.
- Health indicator.
- Business impact summary.
- Owner.
- Last confirmed update time.
- Next action and next expected update.

When a new update is approved, the system should:

1. Post a threaded reply with the detailed update.
2. Use `chat.update` to revise the Anchor message.
3. Store the latest Slack timestamps in Thread Map.
4. Sync sent status and links back to Hub History.

## Flow A: Nudge

1. Cron detects an entity has not been updated within its stale threshold.
2. The system posts a private nudge in the triage channel.
3. The owner replies with raw status, such as `Deploying now, but database is slow`.
4. The language layer reads the reply plus recent context and drafts:
   - A public thread reply.
   - An updated Anchor summary.
5. The owner approves or rejects the draft.
6. Approved updates publish to Slack and update the Thread Map.

The system escalates missing updates, not guessed project health. If the owner ignores the nudge, the public state remains the last confirmed state until a human provides an update.

## Flow B: Live Status

1. A project, incident, or release update is approved.
2. The system posts a new reply in the public Slack thread.
3. The system updates the existing Anchor parent message.
4. The Anchor status, business summary, owner, and next update time change in place.
5. Hub History records the sent state and Slack links.

## Stale Update Escalation

| Time Since Nudge | Action | Audience |
| ---: | --- | --- |
| 0 min | Ask owner for raw update. | Owner in private triage. |
| 15 min | Reminder asking for short reply. | Owner in private triage. |
| 30 min | Escalate update gap to backup owner / TPM / manager. | Private triage. |
| 60 min | For critical incidents or active releases, notify accountable leader. | Leadership triage. |
| Next digest | Mark item as update pending from owner. | Controlled executive visibility. |

Critical incidents and active releases should use shorter thresholds than normal projects.

## Future Slash Commands

| Command | Purpose |
| --- | --- |
| `/incident` | Start a critical issue flow. |
| `/update` | Add raw owner context to an existing project, incident, or release. |
| `/release` | Create a release event draft during the current Personal Assistant phase. |

`/update` should eventually attach to an existing Thread Map entity instead of starting a new communication flow.
