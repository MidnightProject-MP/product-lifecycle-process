# Automation Vision

This repository defines the operating model for an automated product lifecycle communication process.

## Core Idea

The project dashboard is the real-time source of truth.

The TPM is responsible for keeping the dashboard current. After every dashboard update, an automated flow evaluates what changed and determines whether a communication should be logged, reviewed, or eventually sent to Slack using the appropriate template.

## Target Flow

```text
TPM updates dashboard
        |
        v
Automation captures old state and new state
        |
        v
Trigger rules evaluate the change
        |
        v
Communication candidate is logged when needed
        |
        v
Owner reviews or approves, depending on trigger severity
        |
        v
Slack message is generated from the correct template
        |
        v
Message is sent and communication history is recorded
```

## Automation Responsibilities

The automated flow should:

- Detect meaningful dashboard changes.
- Compare old state to new state.
- Apply trigger rules.
- Identify the communication type.
- Identify the likely audience.
- Select the correct communication template.
- Pre-fill `What`, `So What`, and `What's Next`.
- Log the communication candidate.
- Require review or approval when risk, severity, or audience warrants it.
- Send approved communications to Slack.
- Record what was sent, when, where, and by whom.

## Human Responsibilities

| Role | Responsibility |
| --- | --- |
| TPM | Keeps dashboard current and accurate. |
| Lead PM | Owns stakeholder communication quality and ensures the message reflects business/product reality. |
| Phase Owner | Provides accurate input for their phase and owns the relevant risk or next action. |
| Release Owner | Confirms release readiness, release status, and rollout/release communications. |
| Executive / Accountable Leader | Approves high-risk decisions, exceptions, or escalations when needed. |

## Communication Candidate

A communication candidate is a logged item created by automation when a dashboard update appears to require communication.

It should include:

- Project.
- Field changed.
- Old value.
- New value.
- Trigger.
- Severity.
- Suggested audience.
- Suggested template.
- Draft message.
- Owner.
- Review or approval requirement.
- Due by.
- Sent status.

## Automation Maturity

| Level | Description |
| --- | --- |
| Level 1 | Dashboard is updated manually; communication rules are documented. |
| Level 2 | Dashboard changes automatically create communication candidates. |
| Level 3 | Communication candidates pre-fill messages using templates. |
| Level 4 | Low-risk communications send automatically to Slack. |
| Level 5 | High-risk communications route for approval, then send and log automatically. |

## Guiding Principle

Automation should not replace ownership. It should make ownership visible, make communication harder to miss, and reduce the manual effort needed to keep stakeholders informed.

