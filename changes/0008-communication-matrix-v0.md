# Change Proposal 0008: Communication Matrix v0

## Problem

The process needs a concrete communication matrix that maps lane, trigger, and timing to payload, audience, template, approval, and send rules.

## Proposal

Add:

- Communication matrix documentation.
- Spreadsheet-ready communication matrix CSV.
- Matrix usage rules for evaluation order, lane precedence, bundling, and approvals.

## Expected Impact

- The automation process has a practical rules table.
- Projects, incidents / bugs, stray stories, and production releases can be evaluated consistently.
- Communication candidates can be generated with predictable payloads and review paths.

## Risks

- v0 may not cover every edge case.
- Some audience/channel names will need local Slack channel mapping.
- Auto-send rules should remain conservative until tested with real updates.

## Adoption Notes

Use this as v0.1. Validate it against recent projects, critical bugs, stray stories, and production releases before building automation logic.

