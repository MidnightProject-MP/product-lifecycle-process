# 0006 Separate Test Slack From Live Slack And Freeze Graph By Default

## Status

Accepted

## Context

The Communication Console is now the PM front door. PMs need to see how a message will land in Slack before approving the real send, and automatically generated drafts should be visible in a sandbox channel without consuming the active Queue row.

The passive graph is useful for the broader Personal Assistant direction, but it does not yet power a visible communication feature. Keeping it active by default adds sheets, logs, and runtime work without improving the PM workflow.

## Decision

The Hub keeps separate live and test Slack metadata:

- Live Slack channel, anchor, thread, latest reply, and permalink remain the source of truth for approved communications.
- Test Slack channel, anchor, thread, latest reply, and permalink are tracked in parallel.
- Test sends never remove a Queue row or advance the live Slack state.

Registry Settings now support `TEST_*_CHANNEL` keys. If a test channel is blank, the Hub falls back to the matching `DEFAULT_*_CHANNEL`, which supports the current sandbox-first setup.

Passive graph memory is disabled by default. `ENABLE_PASSIVE_GRAPH_MEMORY = TRUE` is required before setup or skills create/write graph sheets.

## Consequences

PMs can send or automatically receive sandbox Slack tests while preserving the real approval/send workflow.

History can show both the live message that was approved and the latest test message that preceded it.

Graph work remains available for future Personal Assistant memory features, but it no longer adds default complexity to communication automation.
