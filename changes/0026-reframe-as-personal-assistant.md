# Change Proposal 0026: Reframe Repo as Personal Assistant

## Problem

The repo started as a product lifecycle and communication process project. The current automation has grown into the first capability of a broader Personal Assistant product, but the repo still presents it as a POC under `poc/`.

That creates confusion about product direction, deployment paths, and what is actually implemented today.

## Proposal

Reframe the repo around Personal Assistant:

- Move the current implementation root from `poc/` to `personal-assistant/`.
- Rename current-facing product copy to Personal Assistant.
- Keep the current communication automation as the only implemented capability.
- Document the broader AI-first personal app suite as future architecture only.
- Preserve existing Apps Script project IDs and push-only clasp deployment behavior.

## Expected Impact

- The repo presents one coherent product direction.
- Communication automation remains usable and deployable.
- Future architecture is visible without implying that non-communication modules already exist.
- Deployment validation and GitHub Actions point to the new implementation root.

## Risks

- Path changes can break CI if workflow and validator paths are not updated together.
- Over-renaming stable internal contracts could break installed triggers, sheets, or Slack workflows.
- Future architecture documentation could be mistaken for current implementation unless status labels are explicit.
