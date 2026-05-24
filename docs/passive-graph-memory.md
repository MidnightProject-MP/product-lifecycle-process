# Passive Graph Memory

Personal Assistant can keep a passive W-Graph under the existing communication workflow, but it is disabled by default.

The graph is not a presentation layer. It does not change Queue, Review, Flow Console, Registry, Slack templates, Slack anchors, or approval rules. It records long-term continuity behind the scenes.

Graph expansion is paused for now. New graph behavior should only be added when it powers a visible Communication Console, review guidance, reporting, or memory export feature. Enable it only by setting the Hub Script Property `ENABLE_PASSIVE_GRAPH_MEMORY = TRUE`.

## Operational Store

When enabled, the Hub owns four hidden graph sheets:

| Sheet | Purpose |
| --- | --- |
| `Graph_Entities` | One graph entity per communication flow, keyed by `Flow ID`. |
| `Graph_W_Nodes` | Five W-memory nodes per entity: `Who`, `What`, `Where`, `When`, `Why`. |
| `Graph_Edges` | Relationships between entities, W-nodes, queue rows, events, and Slack anchors. |
| `Graph_Events` | Append-style audit of graph observations. |

Graph writes are best-effort. When the graph flag is off, graph skills return a skipped result and do not create or write graph sheets. When the flag is on, a graph write failure logs to `Run_Log` but does not block draft creation, approval, Slack sending, History, or Flow_State.

## Verification Rule

Draft creation and save actions are recorded as lightweight pending graph events. Once a human approves a message and it is sent or logged, the included W-node values are treated as verified communication memory.

Discarded draft content is not promoted to verified memory.

## Export

`exportGraphMemoryToDrive()` writes:

- `graph_data.json`
- `calibration_log.json`

Set `ENABLE_PASSIVE_GRAPH_MEMORY = TRUE` and the optional Hub Script Property `GRAPH_EXPORT_FOLDER_ID` to enable export. Without either setting, export is skipped with a log notice.

The Drive JSON files are a bridge toward the future Drive-native Personal Assistant. They are not the operational source of truth in this version.
