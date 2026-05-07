# Change Proposal 0010: Simplify Project Communication Triggers

## Problem

Project communication had too many separate triggers. Planned status updates, confidence drops, and IT risk increases should not each create separate communication flows.

## Proposal

Simplify project communication:

- Planned project status updates are bundled into the weekly digest.
- Confidence drops and IT risk increases are evaluation inputs, not standalone communication triggers.
- A single unexpected status change trigger handles material changes in status, confidence, risk, gate confidence, timeline, scope, release, or stakeholder expectations.

## Expected Impact

- Less communication noise.
- Simpler automation logic.
- Clearer distinction between dashboard updates and stakeholder communications.

## Risks

- Weekly digest must be reliable or planned status visibility will suffer.
- Materiality thresholds for unexpected status changes need to be defined.

## Adoption Notes

Start with conservative materiality thresholds. Adjust after reviewing real dashboard updates.

