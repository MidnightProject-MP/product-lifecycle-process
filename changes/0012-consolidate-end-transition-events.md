# Change Proposal 0012: Consolidate End and Transition Events

## Problem

Some lifecycle states can end for many reasons. Creating a separate trigger for each possible destination makes the communication matrix too large and harder to automate.

## Proposal

Prefer a single end or transition event when the same state is exiting for multiple possible reasons.

For stray stories, replace separate destination events with:

```text
Stray story exited intake
```

The message payload should include:

- Final disposition.
- Destination.
- Reason.
- New owner.
- Next workflow.

## Expected Impact

- Fewer unique triggers.
- Cleaner matrix.
- More flexible automation.
- Destination-specific detail moves into the message payload where it belongs.

## Risks

- The template must capture enough detail to make the destination clear.
- Some destinations may still require handoff-specific automation after the end event.

## Adoption Notes

Apply this pattern to other lanes when multiple terminal states represent the same communication need.

