# Passive Graph Memory

Personal Assistant now keeps a passive W-Graph under the existing communication workflow.

The graph is not a presentation layer. It does not change Queue, Review, Flow Console, Registry, Slack templates, Slack anchors, or approval rules. It records long-term continuity behind the scenes.

## Operational Store

The Hub owns four hidden graph sheets:

| Sheet | Purpose |
| --- | --- |
| `Graph_Entities` | One graph entity per communication flow, keyed by `Flow ID`. |
| `Graph_W_Nodes` | Five W-memory nodes per entity: `Who`, `What`, `Where`, `When`, `Why`. |
| `Graph_Edges` | Relationships between entities, W-nodes, queue rows, events, and Slack anchors. |
| `Graph_Events` | Append-style audit of graph observations. |

Graph writes are best-effort. A graph write failure logs to `Run_Log` but does not block draft creation, approval, Slack sending, History, or Flow_State.

## Verification Rule

Draft content is recorded as pending memory. Once a human approves a message and it is sent or logged, the included W-node values are treated as verified communication memory.

Discarded draft content is not promoted to verified memory.

## Export

`exportGraphMemoryToDrive()` writes:

- `graph_data.json`
- `calibration_log.json`

Set the optional Hub Script Property `GRAPH_EXPORT_FOLDER_ID` to enable export. Without it, the graph remains fully operational in hidden Hub sheets and export is skipped with a log notice.

The Drive JSON files are a bridge toward the future Drive-native Personal Assistant. They are not the operational source of truth in this version.
