# Work Item Types

The communication automation must support four primary communication lanes: projects, incidents / bug reports, stray stories, and production releases.

Each work item type has different ownership, trigger rules, communication expectations, and review needs.

## Summary

| Work Item Type | Source of Truth | Primary Owner | Communication Pattern |
| --- | --- | --- | --- |
| Project | Executive dashboard | TPM updates dashboard; Lead PM owns communication quality. | Dashboard state changes trigger communication candidates. Planned status updates and weekly digest use dashboard fields. |
| Incident / Bug Report | Incident or bug tracker | Phase owner based on issue; QA / Dev / IT Product Management contribute depending on root cause. | Critical bugs trigger leadership communication. Non-critical bugs do not trigger leadership communication. |
| Stray Story | Backlog or intake list | Scrum Product Owner / Product intake owner | Reviewed in weekly prioritization meeting. Communication focuses on disposition, priority, owner, and next step. |
| Production Release | Release tracker / release calendar | Release Owner | Release communications bundle projects, fixes, incidents, and stray stories where possible to avoid overcommunication. |

## Projects

Projects represent planned or managed initiatives that move through lifecycle phases and major gates.

Project communication is driven by:

- Dashboard updates.
- Status, confidence, risk, exposure, and gate changes.
- Planned status cadence.
- Weekly digest.
- Release and rollout events.

## Incidents and Bug Reports

Incidents and bugs represent defects, service issues, regressions, user-impacting failures, or unexpected behavior.

Incident / bug communication is driven by:

- Severity.
- Customer or user impact.
- Operational impact.
- Safety, privacy, security, compliance, or data risk.
- Release impact.
- Executive visibility requirement.
- Root-cause and remediation progress.

Critical bugs require leadership-level communication. Non-critical bugs do not.

## Stray Stories

Stray stories are work items that exist outside a committed project plan, active incident response, or approved roadmap flow.

Examples:

- Standalone enhancement requests.
- Small operational asks.
- Unowned backlog items.
- Follow-up stories from support, QA, PMO, or engineering.
- Work that may be valid but has not been prioritized or assigned to a larger initiative.

Stray stories should be reviewed in the weekly prioritization meeting.

The communication goal is to make disposition clear:

- Accepted.
- Rejected.
- Deferred.
- Needs discovery.
- Needs requirements.
- Converted into project.
- Attached to existing project.
- Treated as bug / incident.

## Production Releases

Production releases represent the act of moving change into production.

They may include:

- Project deliverables.
- Bug fixes.
- Incident remediations.
- Stray stories.
- Technical maintenance.
- Operational changes.

Release communication should avoid item-by-item noise. Bundle and group release contents whenever possible.

Useful grouping patterns:

- Customer-facing changes.
- Internal workflow changes.
- Bug fixes.
- Incident follow-ups.
- Technical / infrastructure changes.
- Known risks or watch items.
- Items requiring support, operations, training, or leadership awareness.

Production release communication is driven by:

- Release scheduled.
- Go / no-go decision needed.
- Release started.
- Release completed.
- Release delayed.
- Rollback being evaluated.
- Rollback decision made.
- Release rolled back.
- Release completed with known issues.
- Postmortem required.
