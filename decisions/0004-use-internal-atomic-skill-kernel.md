# Decision 0004: Use an Internal Atomic Skill Kernel

## Status

Accepted.

## Context

Personal Assistant needs to grow as a collection of reusable capabilities, not one large workflow script.

The current live capability is communication automation. It already includes multiple separable actions: queueing, review, approval, Slack publishing, anchor updates, flow progression, graph memory, and export.

## Decision

Use an internal Apps Script skill kernel as the first architecture boundary.

Executable skill contracts live in `SkillKernel.gs`, and the human-readable catalog is mirrored in `docs/personal-assistant-skills.md`.

No public skill Web App endpoint is added in this phase.

## Consequences

- Existing user-facing surfaces stay stable.
- New capabilities should be introduced as callable skills first, then wired into UI, triggers, or Slack.
- Skill runs become traceable through `Skill_Run_Log`.
- Code remains the v1 source of truth for executable skill contracts.
- Registry-owned skill configuration can be considered later, after the internal contract stabilizes.
