# Decision 0002: Use Personal Assistant as Product Container

## Decision

- Date: 2026-05-17
- Decision Owner: Philippe Cave
- Status: Proposed

## Context

The communication automation work is becoming the first concrete capability inside a broader AI-first personal assistant direction. At the same time, the broader suite should not be implemented before the current communication automation is stable.

## Decision

Use Personal Assistant as the product container for the repo. Move the current Sheets, Apps Script, and Slack automation under `personal-assistant/`, and keep non-communication modules as future architecture documentation only.

## Rationale

This gives the product a durable direction without prematurely building storage, graph, RAG, BYOK, gateway, or proactive-worker systems.

## Impact

- Current Apps Script deployment continues through the same four Google-side script projects.
- The repo structure and active docs use Personal Assistant naming.
- Existing sheet tabs, event keys, template keys, and script contracts remain stable unless a later change proposal explicitly changes them.
- Future modules require their own proposal before implementation.
