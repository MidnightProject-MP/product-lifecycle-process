# Communication Matrix Rules

These rules explain how automation should use the communication matrix.

## Evaluation Order

1. Identify the communication lane.
2. Capture old state and new state.
3. Match the update to a communication event.
4. Determine severity or criticality when relevant.
5. Check whether communication should be bundled into the heartbeat or release summary.
6. Select the event's template path.
7. Draft `What`, `So What`, and `What's Next`.
8. Apply the send rule.
9. Send, route for review, log only, or skip with rationale.
10. Record message link and sent status.

## Lane Precedence

When an update could belong to more than one lane, use this precedence:

1. Incident / Bug when classification is Critical.
2. Production Release when the communication is about release execution, go / no-go, delay, rollback, or release completion.
3. Project when the communication is about lifecycle phase, project status, risk, confidence, or gate readiness.
4. Stray Story when the item is not yet part of a project, incident, or release.

## Project Trigger Rule

For projects:

- Planned status updates are bundled into the weekly digest.
- Confidence drops, IT risk increases, primary risk changes, and gate confidence changes are evaluation inputs.
- Use `Unexpected status change` only when those inputs materially affect status, gate confidence, timeline, scope, release, rollout, or stakeholder expectations.

## Event Catalog Rule

The communication matrix should stay event-based:

- One row equals one communication event.
- One event maps to one primary trigger.
- One event maps to one primary template path.
- Add detail through template payload fields before adding more trigger rows.

## End Event Rule

Prefer a single end or transition event when one lifecycle state can end for many reasons.

Example:

`Stray story exited intake` is better than separate events for converted to project, attached to existing project, reclassified as bug, rejected, or deferred.

Capture the reason, destination, new owner, and next workflow in the message payload.

## Bundling Rules

Bundle when:

- The audience is the same.
- Timing is compatible.
- Severity is Low or Medium.
- The communication is a weekly digest, release summary, or prioritization summary.
- Bundling makes the message clearer.

Do not bundle when:

- Severity is Critical.
- Leadership action is needed immediately.
- A critical bug is first reported.
- A non-critical bug becomes critical.
- A release is rolled back.
- A gate failed and a decision is needed.
- Bundling would hide important impact or ownership.

## Approval Rules

Approval is required when:

- Severity is Critical.
- Release is delayed, blocked, rolled back, or conditional.
- A gate decision is no-go or conditional go.
- Risk is being explicitly accepted.
- Leadership, customer, safety, privacy, security, compliance, revenue, or reputational impact exists.

Review is enough when:

- Severity is Medium or High but no executive decision is required.
- The message summarizes status, risk, readiness, or release completion.
- The audience is broad but the information is factual and non-controversial.

Auto-send eligibility should start disabled until templates and trigger quality are proven.
