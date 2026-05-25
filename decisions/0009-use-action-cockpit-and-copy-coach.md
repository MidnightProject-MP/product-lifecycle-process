# Decision 0009: Use Action Cockpit and Gemini Copy Coach

## Status

Accepted.

## Context

The Control Center Web App made the spreadsheet optional for PMs, but the first pass still behaved like a functional console. PM reviewers need a clearer front door: what needs action, why it exists, whether test/live Slack routes are safe, and what to do next.

PMs also need help turning template scaffolds into clear Slack-ready communication without giving AI authority to decide what should be sent.

## Decision

Use a Linear/Stripe-style Action Cockpit as the primary Communication App experience.

Add an optional Gemini copy coach. Gemini generates an initial editable draft when a Queue item has no saved final title/body, and can re-draft the PM's current edit for Slack formatting. The coach returns structured Slack `mrkdwn`. The browser converts that to HTML only for editing. The PM must explicitly test or approve the final message.

Use a hybrid AI generation path: an optional time-driven Apps Script worker can pre-polish pending Queue rows, and the Web App uses just-in-time generation if the PM opens a draft before the worker gets there. Queue rows are marked complete after JIT generation so the worker does not overwrite a PM-facing draft.

## Consequences

- PM workflow is organized by decision state instead of spreadsheet state.
- Readiness and evidence are visible before live send.
- Templates remain structure and prompt scaffolds, not the final communication surface.
- Slack `mrkdwn` becomes the durable message format; HTML remains an editor concern.
- `GEMINI_API_KEY` is optional. Missing or failed Gemini calls fall back to deterministic template scaffolds.
- The communication system remains GAS, Sheets, and Slack; no standalone frontend stack is introduced in this phase.
