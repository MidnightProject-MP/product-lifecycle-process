# Change Proposal 0011: Refactor Matrix to Event Catalog

## Problem

The prior communication matrix was too granular and introduced a `Change Version` layer that made the model harder to reason about. The system needs one row per unique communication event, with each row matching one trigger and one primary template path.

## Proposal

Refactor the communication matrix into an event catalog:

- One row equals one communication event.
- Each row has one trigger and one primary template.
- Project communication is organized into kickoff, weekly digest heartbeat, happy-path gates/completion, and sad-path exceptions.
- Critical bug communication is organized into critical identification, happy-path fix progress, and sad-path regression/delay/failure.
- Stray stories and production releases keep their own event sets.

## Expected Impact

- The matrix is easier to read.
- Automation can map events to templates more directly.
- Weekly digest becomes the heartbeat for normal project movement.
- Critical bug communication stays focused on a small lifecycle.

## Risks

- Some events may need additional payload fields later.
- Template variants may be needed after real examples are tested.

## Adoption Notes

Use this as the new v0.1 communication matrix shape. Add detail through template payload definitions rather than by multiplying trigger rows.

