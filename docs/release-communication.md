# Production Release Communication

Production releases are their own communication lane because they can overlap with projects, incidents / bug reports, and stray stories.

The goal is to communicate release impact clearly while avoiding overcommunication.

## Release Communication Principles

- Bundle related items into one release communication whenever practical.
- Group release contents by stakeholder impact, not by internal ticket structure.
- Separate go / no-go communication from execution communication.
- Make known risks and rollback posture visible.
- Communicate release start, completion, delay, rollback evaluation, rollback decisions, rollback execution, and postmortem needs when relevant.

## Release Content Grouping

Use these groups when summarizing release contents:

| Group | Use When |
| --- | --- |
| Customer-facing changes | Users or customers will notice a product, workflow, behavior, or experience change. |
| Internal workflow changes | Internal teams need to change behavior, training, or support process. |
| Bug fixes | Defects are fixed without needing a full incident narrative. |
| Incident follow-ups | Release includes remediation from a prior incident or critical bug. |
| Technical / infrastructure changes | Change is operational, technical, or platform-level. |
| Known issues / watch items | Release has accepted risk, deferred fixes, or monitoring needs. |

## Planned and Unexpected Communication

Every phase and gate can produce two communication types:

| Type | Purpose |
| --- | --- |
| Planned Communication | Expected update tied to cadence, phase progress, readiness, go / no-go, release execution, or post-release follow-up. |
| Unexpected Communication | Triggered update caused by a material change, blocker, issue, risk, rollback, delay, failed gate, or postmortem need. |

## Release Communication Moments

| Moment | Planned or Unexpected | Communication Need |
| --- | --- | --- |
| Release scheduled | Planned | What is planned to ship, target timing, included groups, expected impact, readiness path. |
| Go / no-go approaching | Planned | Current readiness, open risks, decision owner, recommendation, decision deadline. |
| Go / no-go decision changed | Unexpected | What changed, impact, new recommendation, decision needed, next update time. |
| Release started | Planned | Release has begun, expected duration, monitoring plan, where updates will appear. |
| Release delayed | Unexpected | Why delayed, impact, new ETA, owner, next update. |
| Release completed | Planned | What shipped, known issues, user exposure, monitoring plan, support notes. |
| Release completed with known issues | Unexpected | Known issues, accepted risk, mitigation, owner, follow-up ETA. |
| Rollback being evaluated | Unexpected | Why rollback is being considered, current impact, decision owner, and decision ETA. |
| Rollback decision made | Unexpected | Decision to continue, delay, or roll back; impact; next execution step. |
| Release rolled back | Unexpected | What rolled back, why, impact, current state, next decision or fix path. |
| Postmortem required | Unexpected | Why postmortem is needed, owner, timeline, scope, and expected outputs. |

## Go / No-Go Payload

A go / no-go communication should answer:

- What release or gate is being evaluated?
- What is included?
- What readiness evidence exists?
- What risks remain?
- What is the recommendation?
- Who decides?
- By when?
- What happens after go, no-go, or conditional go?
