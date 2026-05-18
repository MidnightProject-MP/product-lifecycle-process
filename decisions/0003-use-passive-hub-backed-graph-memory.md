# Decision 0003: Use Passive Hub-Backed Graph Memory

## Decision

- Date: 2026-05-17
- Decision Owner: Philippe Cave
- Status: Proposed

## Context

Personal Assistant needs a durable memory layer, but the current live product should keep the same Sheets, Review Controller, Registry, and Slack presentation flow.

## Decision

Implement the W-Graph as passive Hub-backed memory first. Use hidden Hub sheets as the operational store and optional Drive JSON export as a bridge toward the future Drive-native assistant.

## Rationale

Hub sheets are reliable for Apps Script, easy to repair through setup functions, and observable during development. Drive JSON remains useful for the future architecture without becoming the operational source of truth too early.

## Impact

- Graph memory failures do not block communication workflow execution.
- Approved communication becomes verified graph memory.
- Drafts remain pending memory.
- Future graph/LLM/proactive-worker work can build on exported JSON without changing the current communication UX.
