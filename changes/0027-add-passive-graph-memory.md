# Change Proposal 0027: Add Passive Graph Memory

## Problem

Personal Assistant can send and trace communication, but it does not yet retain structured long-term memory about the entities being communicated about.

Without that memory layer, future assistant capabilities would have to infer continuity from Slack threads, Hub History, or dashboard rows every time.

## Proposal

Add a passive W-Graph under the existing communication workflow:

- Hidden Hub graph sheets store entities, W-nodes, edges, and graph events.
- Existing `Flow ID` becomes the v1 graph entity identity.
- Draft content is recorded as pending memory.
- Approved sent or log-only communication is promoted to verified memory.
- Discarded draft content is not promoted.
- A manual Drive export can write `graph_data.json` and `calibration_log.json`.

The graph must not alter Review, Slack, Registry, templates, approval, or dashboard presentation in this pass.

## Expected Impact

- Personal Assistant gains a structured long-term memory substrate.
- Future Drive-native graph, BYOK, LLM, and proactive briefing work has a concrete export path.
- Current communication automation remains stable and familiar.

## Risks

- Graph writes could add operational noise if not best-effort.
- Unapproved draft facts could be mistaken for confirmed memory if statuses are unclear.
- Drive JSON export could be mistaken for the source of truth before the future client exists.
