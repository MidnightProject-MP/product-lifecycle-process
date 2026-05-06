# Communication Control Log

The communication control log records potential and completed communications generated from dashboard updates.

It is the bridge between real-time dashboard changes and stakeholder communication.

## Purpose

The log should answer:

- What changed?
- Why did the change trigger communication?
- Who needs to know?
- What should be said?
- Does anyone need to review or approve the message?
- Was the communication sent?
- Where is the communication history?

## Recommended Fields

| Field | Purpose |
| --- | --- |
| Communication ID | Unique identifier for the communication candidate. |
| Project | Project or initiative name. |
| Dashboard Field Changed | Field that changed. |
| Old Value | Previous dashboard value. |
| New Value | Updated dashboard value. |
| Trigger | Communication trigger created by the change. |
| Severity | Low, Medium, High, Critical. |
| Communication Type | Status update, risk update, escalation, release update, rollout update, digest item, or post-release update. |
| Suggested Audience | Initial audience based on trigger and project phase. |
| Channel | Intended Slack channel or other destination. |
| Template | Template used to generate the message. |
| What | The factual update. |
| So What | Why the update matters. |
| What's Next | Action, decision, owner, or next update time. |
| Owner | Person accountable for communication quality. |
| Reviewer / Approver | Person required to review or approve before send, if needed. |
| Due By | When the communication should be sent. |
| Sent Status | Draft, pending review, approved, sent, skipped, or superseded. |
| Sent At | Timestamp when sent. |
| Message Link | Link to Slack message or archived communication. |

## Approval Rule

Low-risk planned updates may eventually be sent automatically.

High-risk communications should require review or approval before sending, especially when they involve:

- Red status.
- Critical issue.
- High IT risk.
- Release delay.
- Customer impact.
- Safety, privacy, security, legal, or compliance risk.
- Executive decision or risk acceptance.

