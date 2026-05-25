# Change Proposal 0033: Action Cockpit and Gemini Copy Coach

## Summary

Redesign the GAS-hosted Communication App into a PM-focused Action Cockpit and add an optional Gemini copy coach for Slack-ready draft polish.

## Changes

- Group the first screen by PM decision state: needs review, ready for live, needs context, failed, scheduled soon, stabilizing, and recent tests.
- Show each item as a compact action card with source, owner, event, route state, next action, and why it exists.
- Redesign the draft detail view as an object page with the final title/body editor in the main column and readiness, route state, evidence, flow, and history in the right rail.
- Add Gemini server-side calls through `GEMINI_API_KEY` with optional `GEMINI_MODEL`.
- Store final message content as Slack `mrkdwn`; HTML is only the browser editing/display layer.
- Keep Gemini advisory only: initial draft generation and AI re-draft require PM review and explicit test/approve.
- Add optional `processPendingCommunicationAiDrafts` worker support with Web App just-in-time fallback.
- Keep deterministic template scaffolds as the fallback when Gemini is missing or fails.

## Compatibility

- No sheet names, event keys, flow IDs, Slack routing rules, or scheduled polling behavior change.
- The spreadsheet remains the backend/admin surface.
- The older sidebar/modal console remains fallback/admin tooling.
- Graph behavior remains paused and omitted from the Control Center communication product.
