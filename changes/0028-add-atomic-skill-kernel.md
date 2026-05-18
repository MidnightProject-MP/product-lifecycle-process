# Change Proposal 0028: Add Atomic Skill Kernel

## Problem

The communication automation now has several important behaviors: draft creation, approval, template rendering, Slack posting, anchor updates, flow state, history, scheduling, and passive graph memory.

Without a clear internal boundary, these behaviors become harder to test independently and harder to reuse as Personal Assistant grows beyond communication automation.

## Proposal

Add an internal Apps Script skill kernel:

- `runSkill(skillId, input, options)` becomes the standard callable boundary.
- `Skill_Run_Log` records every skill execution with a run ID, parent run ID, input hash, output summary, error, and duration.
- Core communication behavior is exposed as stable snake_case skills.
- Existing public wrappers remain intact so the Hub, Review Controller, Slack slash commands, and triggers keep their current user-facing behavior.
- Graph-assisted review capabilities are exposed as advisory skills, with no LLM calls and no approval blocking.

## Expected Impact

- Each meaningful action can be tested and traced independently.
- The send workflow becomes easier to observe because render, target resolution, Slack post, anchor update, history, flow, scheduling, and graph writes each produce skill-level telemetry.
- Future Personal Assistant capabilities can compose existing skills rather than duplicating workflow logic.

## Risks

- Skill logging adds more internal rows and should stay hidden by default.
- Too much skill fragmentation could make debugging noisy unless parent run IDs are used consistently.
- Some skills, such as Slack posting, are intentionally not idempotent by themselves; callers must continue to own dedupe and approval boundaries.
