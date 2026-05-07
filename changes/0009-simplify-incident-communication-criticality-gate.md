# Change Proposal 0009: Simplify Incident Communication Criticality Gate

## Problem

Incident and bug communication was too nuanced for the intended process. Leadership communication should be controlled by a simple criticality gate.

## Proposal

Use this rule:

```text
Critical = leadership-visible critical bug communication flow.
Non-critical = no leadership communication.
```

Non-critical bugs remain tracked through normal bug workflow, release notes, project status, or team-level channels when appropriate.

## Expected Impact

- Incident communication becomes easier to automate.
- Leadership communication is reserved for critical bugs.
- Non-critical bugs no longer create noisy or ambiguous leadership updates.

## Risks

- Criticality classification must be made quickly and responsibly.
- Borderline issues should be treated as critical until downgraded by the accountable owner.

## Adoption Notes

Automation should evaluate incident communication only after criticality is assigned. If criticality is unknown, default to critical until reviewed.

