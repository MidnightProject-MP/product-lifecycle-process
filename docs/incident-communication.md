# Incident and Bug Communication

Incidents and bug reports use a simple communication gate:

```text
Critical = leadership-visible critical bug communication flow.
Non-critical = no leadership communication.
```

Non-critical bugs are still tracked, prioritized, fixed, validated, and may be included in release notes or team-level updates. They do not trigger leadership communication unless they are reclassified as critical.

## Criticality Gate

| Classification | Communication Requirement |
| --- | --- |
| Critical | Leadership communication required. Use the critical bug template and continue updates until stabilized, downgraded, or closed. |
| Non-critical | No leadership communication. Track through normal bug workflow, project status, release notes, or team-level channels as appropriate. |

## Critical Criteria

Classify a bug or incident as critical when one or more are true:

- Broad customer or user impact.
- Major operational disruption.
- Safety, privacy, security, compliance, or data integrity risk.
- Revenue, contractual, reputational, or executive trust risk.
- Release-blocking defect for a committed production release.
- Severe regression in existing expected behavior.
- No acceptable workaround for a material business or customer function.

## Critical Bug Communication Must Answer

- What happened?
- Who or what is affected?
- How severe is the impact?
- When was it discovered?
- What is the current mitigation or workaround?
- Who owns investigation, fix, QA, and communication?
- Does this affect release, rollout, customers, operations, safety, privacy, security, compliance, revenue, or trust?
- When is the next update?

## Leadership Communication Rule

Leadership communication is controlled by the criticality gate.

- If critical: send leadership communication.
- If non-critical: do not send leadership communication.
- If uncertain: treat as critical until downgraded by the accountable owner.

## Update Cadence

| Classification | Minimum Update Cadence |
| --- | --- |
| Critical | Initial communication as soon as confirmed; updates every 30-60 minutes or at agreed milestones until stabilized. |
| Non-critical | No leadership cadence. Use normal bug workflow, release notes, or team-level updates. |

