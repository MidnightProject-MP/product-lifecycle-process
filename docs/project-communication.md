# Project Communication

Project communication is intentionally simple.

```text
Planned project status = weekly digest.
Unexpected project change = unexpected status change communication.
```

Confidence drops, IT risk increases, primary risk changes, and material gate confidence changes are not separate communication types. They are signals that may trigger an unexpected status change.

## Planned Project Status

Planned project status updates are bundled into the weekly digest.

The weekly digest should summarize:

- Current phase.
- User exposure.
- Progress.
- Status.
- Owner confidence.
- IT risk level.
- Primary risk.
- Next major gate.
- Next gate ETA.
- Primary rollout target.
- Exceptions, decisions, or high-risk gates.

## Unexpected Status Change

Send an unexpected status change communication when a dashboard update materially changes stakeholder expectations.

Examples:

- Status changes to Yellow or Red.
- Current phase changes unexpectedly.
- Confidence drops materially.
- IT risk increases materially.
- Primary risk changes materially.
- Next gate ETA slips materially.
- Gate confidence changes.
- Scope, release, rollout, or user exposure changes unexpectedly.

## Rule

Do not create separate project communications for confidence drops or IT risk increases.

Use them as evaluation inputs:

```text
Confidence drop or IT risk increase
        |
        v
Does this materially affect status, gate confidence, timeline, scope, release, or stakeholder expectations?
        |
        +-- No: dashboard update only; include in weekly digest.
        |
        +-- Yes: unexpected status change communication.
```

