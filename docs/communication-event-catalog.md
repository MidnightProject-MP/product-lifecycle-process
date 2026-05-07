# Communication Event Catalog

The communication system is based on unique communication events.

Each row should map to one trigger and one primary template path.

```text
Work item lane + communication event = trigger + template + audience + send rule
```

Weekly digest is the heartbeat. It bundles normal progress, happy-path movement, and non-urgent updates. Event communications are reserved for kickoffs, gates, critical bugs, release execution, and meaningful exceptions.

## Project Events

| Path | Event | Trigger | Template | Notes |
| --- | --- | --- | --- | --- |
| Start | Project kickoff | Project enters managed lifecycle and has owner, scope intent, and first gate. | status-update | Initial communication that establishes project existence, ownership, current phase, and next gate. |
| Heartbeat | Weekly project digest item | Project is active during weekly digest cycle. | status-update | Bundles planned status, happy-path progress, minor risk movement, and gate heartbeat. |
| Happy Path | Gate approaching | Next gate is inside lead time and requires readiness attention. | go-no-go | Prepares stakeholders for readiness review or go / no-go. |
| Happy Path | Gate passed | Gate is approved or completed. | status-update | Usually bundled into weekly digest unless it changes launch/release expectations. |
| Happy Path | Project completed | Project reaches completion, release/rollout handoff, or post-release closure. | status-update | Closes the loop on outcome, ownership, and next lifecycle decision. |
| Sad Path | Unexpected status change | Status, confidence, risk, scope, user exposure, or stakeholder expectation changes materially. | risk-update | Single exception trigger for material project state change. |
| Sad Path | Timeline updated | Next gate ETA, release expectation, rollout timing, or committed milestone changes materially. | risk-update | Can be standalone if material; otherwise included in weekly digest. |
| Sad Path | Gate missed / failed / delayed | Gate does not happen as planned, fails readiness, or decision is no-go / conditional. | escalation | Requires recovery path, decision owner, new ETA, and next update time. |

## Critical Bug Events

Only critical bugs create leadership communication.

Non-critical bugs are tracked through the normal bug workflow and may appear in release notes or team-level updates, but they do not trigger leadership communication.

| Path | Event | Trigger | Template | Notes |
| --- | --- | --- | --- | --- |
| Start | Critical bug identified | New bug is classified as critical, or existing bug is escalated to critical. | critical-bug-leadership | Opens the critical bug communication flow. |
| Happy Path | Investigating | Critical bug investigation is active and owner is assigned. | critical-bug-leadership | Confirms ownership, impact, mitigation, and next update time. |
| Happy Path | Fix in progress | Fix owner is assigned and remediation is underway. | critical-bug-leadership | Communicates path to resolution and remaining uncertainty. |
| Happy Path | Fix in QA | Fix is ready for validation or actively being validated. | critical-bug-leadership | Communicates validation status and release readiness implications. |
| Happy Path | Fix ready for release | Fix has passed validation and is ready to enter release flow. | critical-bug-leadership | Ends the bug-specific leadership flow and hands off to release communication. |
| Sad Path | Critical bug state regressed | Bug moves backward, such as Fix in QA back to Investigating or Fix in progress. | critical-bug-leadership | Communicates why confidence changed and what the new path is. |
| Sad Path | Critical bug delayed | Expected fix, QA, or release-readiness timing slips materially. | critical-bug-leadership | Communicates new ETA, impact, and mitigation. |
| Sad Path | Fix failed | Attempted fix does not resolve issue or introduces unacceptable risk. | critical-bug-leadership | Communicates reset of path, owner, and next update time. |

## Stray Story Events

| Path | Event | Trigger | Template | Notes |
| --- | --- | --- | --- | --- |
| Start | Stray story submitted | Story enters intake outside project, bug, or release flow. | stray-story-disposition | Log only; bundle into weekly prioritization agenda. |
| Heartbeat | Weekly prioritization summary | Weekly prioritization meeting completes. | stray-story-disposition | Bundles dispositions and next steps. |
| Outcome | Disposition changed | Story is accepted, rejected, deferred, attached, converted, or reclassified. | stray-story-disposition | Communicates decision to requester and owners when needed. |
| End / Transition | Stray story exited intake | Story leaves stray-story intake because it is converted, attached, rejected, deferred, accepted into backlog, or reclassified. | stray-story-disposition | Single end event. Destination and reason are included in the message payload. |

For stray stories, do not create separate events for every possible destination. Use `Stray story exited intake` and include:

- Final disposition.
- Destination: backlog, project, existing project, bug / incident, release, rejected, deferred.
- Reason.
- New owner.
- Next workflow.

## Production Release Events

| Path | Event | Trigger | Template | Notes |
| --- | --- | --- | --- | --- |
| Start | Release scheduled | Release receives a planned production schedule. | release-update | Communicates release window, grouped contents, and readiness path. |
| Happy Path | Go / no-go approaching | Release decision window opens. | go-no-go | Communicates readiness evidence, open risks, recommendation, and decision owner. |
| Happy Path | Release started | Production release begins. | release-execution | Communicates execution has started and where status will be tracked. |
| Happy Path | Release completed | Production release completes successfully. | release-execution | Communicates what shipped, known issues, monitoring, and support notes. |
| Sad Path | Release delayed | Release schedule changes, misses planned timing, or is delayed during execution. | escalation | Communicates reason, impact, new ETA, and decision owner. |
| Sad Path | Release rolled back | Release is fully or partially rolled back. | escalation | Communicates current production state, impact, and next decision path. |
| Sad Path | Postmortem needed | Rollback, critical bug, failed gate, or material issue requires root-cause review. | escalation | Communicates postmortem owner, scope, timing, and expected outputs. |

## End Event Rule

In general, prefer a single end or transition event instead of separate triggers for each possible reason.

The event should communicate that the work item has exited its current flow. The reason, destination, owner, and next workflow should be part of the message payload.
