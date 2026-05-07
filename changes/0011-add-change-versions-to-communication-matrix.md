# Change Proposal 0011: Add Change Versions to Communication Matrix

## Problem

Triggers describe the communication event, but automation also needs to know the specific old-state to new-state transition that caused the trigger to fire.

## Proposal

Add `Change Version` to the communication matrix and document release change versions:

- Release scheduled: new schedule / schedule changed.
- Go / no-go approaching: gate window opened / readiness decision required.
- Release started: execution started.
- Release completed: execution completed.
- Release delayed: schedule missed / delay declared.
- Release rolled back: full rollback / partial rollback.
- Postmortem needed: postmortem required.

## Expected Impact

- The communication matrix becomes more automation-ready.
- Release communication triggers can be evaluated from concrete state transitions.
- Future trigger rules can use consistent old-state / new-state language.

## Risks

- Change versions for non-release lanes still need refinement.
- Source systems must expose enough state history to evaluate transitions reliably.

## Adoption Notes

Start with production release change versions, then refine project, incident, and stray story change versions against real workflow data.

