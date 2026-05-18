# Automation Vision

Personal Assistant defines the operating model for turning technical chaos into strategic clarity.

The current implementation creates event-keyed drafts from dashboard, Slack, and manual inputs. The next architecture makes Slack the executive source of truth through editable Anchor messages, with threads as the detailed audit trail.

## Core Idea

The system should capture raw operational updates, translate them into business-impact communication, route them for the right level of review, and publish them where stakeholders already work.

```text
Source update
        |
        v
Automation compares old state to new state
        |
        v
Personal Assistant Registry resolves event, template, routing, and approval policy
        |
        v
Personal Assistant Hub queues draft and records observability
        |
        v
Owner reviews or approves in private triage
        |
        v
Slack thread receives detailed update
        |
        v
Slack Anchor is updated as the live executive view
```

## Target Responsibilities

The automated flow should:

- Detect meaningful project, incident, story, and release changes.
- Compare old state to new state.
- Apply event and trigger rules from the Registry.
- Create drafts with clear `What`, `So What`, and `What's Next`.
- Use an LLM layer, later, to translate raw technical notes into business-impact language.
- Require review or approval when risk, severity, or audience warrants it.
- Post approved detailed updates into Slack threads.
- Update the public Slack Anchor message with the latest confirmed status.
- Track Slack timestamps in Thread Map.
- Nudge owners when status is stale.
- Escalate missing updates without inventing or implying unconfirmed status.
- Record what was sent, when, where, and by whom.

## Human Responsibilities

| Role | Responsibility |
| --- | --- |
| TPM | Keeps dashboard and automation mapping current. |
| Lead PM | Owns stakeholder communication quality and confirms product/business reality. |
| Phase Owner | Provides accurate input for their phase and owns the relevant risk or next action. |
| Release Owner | Confirms release readiness, release status, rollout communication, and rollback posture. |
| Executive / Accountable Leader | Approves high-risk decisions, exceptions, or escalations when needed. |

## Communication Candidate

A communication candidate is a logged item created by automation when a source update appears to require communication.

It should include:

- Entity ID and Flow ID.
- Event key.
- Old state and new state summary.
- Severity and audience.
- Suggested template.
- Draft thread reply.
- Draft Anchor summary.
- Owner.
- Review or approval requirement.
- Due by / stale threshold.
- Slack target.
- Sent status.

## Slack Operating Model

Public Slack is split into two layers:

- Anchor parent message: current executive state.
- Thread replies: detailed history and audit trail.

Private triage is used for:

- Owner nudges.
- Raw PM replies.
- AI-assisted draft generation.
- Approval actions before publication.

## Automation Maturity

| Level | Description |
| --- | --- |
| Level 1 | Communication rules are documented and dashboard updates are manual. |
| Level 2 | Source changes create logged communication candidates. |
| Level 3 | Candidates pre-fill messages using Registry templates. |
| Level 4 | Approved messages post to Slack threads and History. |
| Level 5 | Anchor messages update as live executive dashboards. |
| Level 6 | AI nudges owners, drafts updates, and escalates stale communication gaps. |

## Guiding Principle

Automation should not replace ownership. It should make ownership visible, make stale communication hard to miss, and reduce the manual effort needed to keep stakeholders informed.
