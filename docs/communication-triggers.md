# Communication Triggers

Communication is triggered when stakeholders need awareness, action, approval, or a decision.

For the communication matrix, `Trigger` is the practical version of "why are we communicating?"

## Trigger Categories

| Category | Triggers |
| --- | --- |
| Cadence-Based | Planned status update, weekly digest, post-release outcome review. |
| Event-Based | New initiative opened, phase change, readiness gate reached, go / no-go approaching, release scheduled, release started, release completed, rollout started or changed. |
| Exception-Based | Unexpected status change, new critical issue found, critical bug reported, blocker identified, risk accepted or exception granted, release delayed, release rolled back, postmortem needed. |
| Decision-Based | Decision needed, scope change proposed, tradeoff required. |
| Intake-Based | Stray story submitted, stray story disposition changed. |
| Feedback-Based | Customer feedback received, support or operations feedback received, metrics threshold crossed. |

## Core Triggers

| Trigger | Why We Communicate |
| --- | --- |
| New initiative opened | A new request exists and needs ownership, triage, and next steps. |
| Planned status update | Stakeholders need predictable visibility into current state, progress, risks, and next steps. |
| Unexpected status change | Something materially changed in phase, scope, timeline, quality, risk, priority, or confidence. |
| New critical issue found | A high-severity issue may affect customers, operations, safety, release readiness, or business trust. |
| Critical bug reported | A critical defect or regression may affect customers, operations, revenue, safety, trust, or release readiness and requires leadership-level communication. |
| Blocker identified | Work is stuck and needs action, decision, escalation, or dependency resolution. |
| Decision needed | A decision is required to move forward or avoid delay or risk. |
| Scope change proposed | The team is considering adding, removing, deferring, or changing committed work. |
| Readiness gate reached | The work is approaching build, validation, release, rollout, or post-release exit criteria. |
| Risk accepted or exception granted | The team is moving forward despite a known gap or risk, and that acceptance must be visible. |
| Release scheduled | Stakeholders need to know what is shipping, when, impact, readiness, and support plan. |
| Go / no-go approaching | A phase gate or production release needs a readiness decision before proceeding. |
| Release started | A production release has begun and stakeholders need execution visibility. |
| Release completed | Stakeholders need confirmation of what shipped, where, known issues, and monitoring plan. |
| Release delayed | A planned release or gate will not happen as expected and stakeholders need impact, new ETA, and next action. |
| Release rolled back | A release was reversed or partially reversed and stakeholders need current state, impact, and next decision path. |
| Postmortem needed | A material issue, rollback, critical bug, or failed gate requires root-cause analysis and systemic follow-up. |
| Rollout started or changed | The exposure, audience, enablement, or adoption path changed or began. |
| Feedback received | Feedback may affect requirements, priority, quality, adoption, or future roadmap. |
| Weekly digest | Leaders and stakeholders need a concise cross-project summary without reading every update. |
| Stray story submitted | A work item exists outside a committed project, incident, or approved roadmap flow and needs prioritization. |
| Stray story disposition changed | A stray story was accepted, rejected, deferred, attached to a project, converted into a project, or treated as a bug / incident. |

## Payload Rule

Every triggered communication should answer:

- What changed or needs attention?
- So what does it mean for the audience?
- What happens next, by when, and who owns it?
