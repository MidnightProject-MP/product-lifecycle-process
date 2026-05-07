# Incident and Bug Communication

Incidents and bug reports use severity-based communication.

Critical bugs require leadership-level communication.

## Severity Model

| Severity | Meaning | Communication Requirement |
| --- | --- | --- |
| Critical | Broad customer impact, major operational impact, safety/privacy/security/compliance risk, revenue impact, release-blocking defect, or severe regression. | Leadership communication required immediately. Ongoing updates required until stabilized or downgraded. |
| High | Material user or operational impact, important customer issue, significant workaround, or meaningful release risk. | Stakeholder communication required. Leadership informed when business impact is material. |
| Medium | Limited impact, workaround available, not release-blocking. | Track in normal status or team-level update. Escalate if impact grows. |
| Low | Minor issue, cosmetic defect, small usability issue, or low-risk follow-up. | No broad communication required unless bundled in digest or release notes. |

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

Send leadership communication when any of the following are true:

- Severity is Critical.
- Customer-facing outage or severe degradation exists.
- Safety, privacy, security, compliance, or data integrity risk exists.
- A release must be stopped, delayed, rolled back, or hotfixed.
- A high-visibility customer, executive, or business function is materially affected.
- The issue creates reputational or contractual risk.

## Update Cadence

| Severity | Minimum Update Cadence |
| --- | --- |
| Critical | Initial communication as soon as confirmed; updates every 30-60 minutes or at agreed milestones until stabilized. |
| High | Same business day; then daily or at major status changes. |
| Medium | Normal project or team status cadence. |
| Low | No required cadence unless included in digest or release notes. |

