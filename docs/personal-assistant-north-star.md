# Personal Assistant North Star

This document is the repo-level north star for the broader Personal Assistant platform.

It is intentionally **architecture documentation only**. It does not implement storage, graph memory, embeddings, sensors, connectors, reasoning, or a new runtime. The current live product remains the Control Center Communication App.

Future work should use this document as the reference point before proposing or implementing a new capability.

## Product Direction

Personal Assistant should become a modular assistant platform that turns personal and professional operational signals into trusted context, clear communication, and eventually proactive decision support.

The first live module is executive communication automation:

- dashboard changes become communication candidates
- PMs review and edit final messages
- sandbox Slack tests prove output safely
- approved messages update Slack anchors, threads, History, and Flow_State

The long-term platform expands from that base into source ingestion, graph memory, semantic retrieval, reconciliation, forecasting, and orchestration.

## Architecture Principles

- **Atomic skills first:** every meaningful action should be an independently callable skill with a stable input, output, side-effect, idempotency, and failure contract.
- **Ports before providers:** source connectors, storage, embeddings, graph operations, and interface actions should call abstract ports, not provider-specific code directly.
- **Evidence before automation:** assistant outputs should preserve provenance links to the source Slack thread, email, document, sheet row, Jira issue, or graph event that informed them.
- **Fail soft:** low-confidence or conflicting synthesis should produce a reviewable ambiguity item, not an automated update.
- **Human approval for external impact:** Slack publishing, source mutations, and high-risk recommendations require an explicit approved path.
- **Swappable infrastructure:** Drive JSON, Drive-hosted embedding files, and Apps Script are acceptable starting points, but no business logic should depend on them as permanent infrastructure.

## Target Layers

| Layer | Purpose | Target v1 provider | Future provider options | Status |
| --- | --- | --- | --- | --- |
| Interface | Human control surfaces and assistant entrypoints | Communication App Web App | Workspace Add-on, Slack app, standalone web app | Communication App current; others future |
| Skill Kernel | Atomic callable actions with standard envelopes and logs | Apps Script `runSkill` | API service, worker runtime, queue-based executor | Partially current |
| Source Connectors | Read source systems into normalized artifacts | Apps Script connectors | Dedicated workers, OAuth-backed services | Future |
| Normalization | Convert raw source artifacts into structured facts | Strict JSON LLM calls and deterministic mappers | Dedicated extraction service | Future |
| Storage | Durable files, config, source index, audit logs | Google Drive JSON / JSONL | S3, GCS, database object storage | Future |
| Embeddings | Chunked semantic retrieval over source artifacts | Drive-hosted manifest/chunk/vector files | Vector DB, pgvector, Vertex, OpenSearch | Future |
| Graph | Long-term entity, relationship, decision, and risk memory | Drive-hosted `graph_data.json` | Graph DB, relational graph tables | Future |
| Reasoning | Reconciliation, ambiguity, RAG, forecasting, collision detection | Skill-driven workflows | Agent service / model gateway | Future |
| Orchestration | Proactive loops, nudges, simulations, self-calibration | Time-driven Apps Script triggers | Event workers, queues, scheduler services | Future |

## Storage Foundation

The north-star storage model is file/object based first, with Google Drive as the initial provider. Future implementations should hide provider details behind a `StoragePort`.

Target capabilities:

- read JSON / JSONL
- write JSON atomically
- append audit records
- list files by logical namespace
- snapshot and restore
- validate schema versions
- support future migration to S3, GCS, or another object store

Target files:

| File | Purpose | Status |
| --- | --- | --- |
| `system_config.json` | Durable assistant configuration, thresholds, skill toggles, source policies, communication style | Future |
| `source_index.json` | Source references, URLs, locators, ownership metadata, hashes, freshness state | Future |
| `graph_data.json` | Graph nodes, edges, graph events, schema version, export timestamp | Future |
| `calibration_log.json` | Human corrections, AI override patterns, confidence calibration records | Future |
| `audit_log.jsonl` | Append-only assistant actions, decisions, provenance, and errors | Future |

Control Center Registry and Config sheets remain the current live configuration surface for communication automation. Long-term durable configuration should move toward Drive JSON contracts, with sheets acting as an editable admin mirror where useful.

## Embedding Foundation

Embeddings should be treated as a retrieval index over source artifacts, not as the authoritative memory.

Target capabilities:

- chunk source artifacts into stable chunk IDs
- generate vectors with a recorded model/version
- store vector references with provenance
- query similar chunks
- rebuild indexes safely
- swap Drive-hosted files for a vector database later

Target files:

| File | Purpose | Status |
| --- | --- | --- |
| `embeddings/manifest.json` | Index metadata, embedding model, dimensions, build timestamp | Future |
| `embeddings/chunks.jsonl` | Chunk IDs, source references, text hashes, short previews, metadata | Future |
| `embeddings/vectors.jsonl` | Chunk IDs and vector payloads or vector references | Future |

The implementation should avoid storing large raw source copies unless explicitly configured. Prefer source references, hashes, metadata, and short previews.

## Graph Foundation

The graph is the assistant's long-term context model. It should connect objectives, projects, releases, incidents, work items, artifacts, decisions, risks, milestones, people, and communications.

Target node types:

- `Objective`
- `Project`
- `Release`
- `Incident`
- `Artifact`
- `WorkItem`
- `Decision`
- `Risk`
- `Milestone`
- `Communication`
- `Person`

Target edge types:

- `belongs_to`
- `depends_on`
- `references`
- `blocks`
- `updates`
- `decides`
- `communicates`
- `conflicts_with`
- `owned_by`

The first graph backbone should use Drive-hosted `graph_data.json`. Sheets may be used later as an inspection or admin mirror, but Drive JSON is the north-star source of truth for the first portable graph implementation.

## Source Connectors

Every connector should emit normalized `SourceArtifact` records with provenance. Connectors should not decide strategy or publish communications directly.

Target connector families:

| Connector | Reads | Emits | Status |
| --- | --- | --- | --- |
| Google Sheets | Dashboard exports, trackers, structured ranges | Source rows, state snapshots, detected changes | Dashboard adapter current; generalized connector future |
| Slack | Channels, messages, threads, permalinks, reactions, bot events | Conversations, decisions, updates, source links | Slash commands current; listener future |
| Google Docs | Charters, plans, comments, headings, revisions | Artifact snapshots, decision/risk candidates, source locators | Future |
| Gmail | Messages, threads, labels, sender/date metadata | Source artifacts and communication signals | Future |
| Jira | Issues, epics, statuses, assignees, blockers, links | Work items and dependency signals | Future |
| Future tools | Calendar, Linear, Drive files, task systems | Source artifacts with provenance | Future |

## Atomic Skill Families

Current Control Center communication skills are the first implemented family. Future platform work should extend the same pattern.

| Family | Example future skills | Status |
| --- | --- | --- |
| Storage | `storage_read_json`, `storage_write_json_atomic`, `storage_append_jsonl`, `storage_backup_snapshot`, `storage_validate_schema` | Future |
| Embeddings | `embedding_chunk_artifact`, `embedding_generate_vectors`, `embedding_upsert_vectors`, `embedding_query_similar`, `embedding_rebuild_index` | Future |
| Graph | `graph_initialize_schema`, `graph_upsert_node`, `graph_upsert_edge`, `graph_record_event`, `graph_resolve_context`, `graph_find_orphans` | Future |
| Connectors | `gmail_scan_delta`, `docs_scan_delta`, `sheets_scan_delta`, `slack_scan_delta`, `jira_scan_delta` | Future |
| Normalization | `normalize_source_artifact`, `extract_decision`, `extract_risk`, `extract_timeline_change`, `detect_conflict` | Future |
| Reconciliation | `reconcile_source_truth`, `request_confirmation_ping`, `resolve_ambiguity`, `record_human_correction` | Future |
| Reasoning | `semantic_query_graph`, `forecast_delivery_window`, `detect_dependency_collision`, `simulate_tradeoff_options` | Future |
| Communication | Current queue, save, test, approve, discard, Slack send, History, Flow_State skills | Current |

Every skill contract should document:

- skill ID and version
- layer/family
- input schema
- output schema
- reads
- writes and side effects
- approval requirement
- idempotency key behavior
- failure behavior
- provenance behavior
- timing/observability fields

## Data Contracts

These contracts are directional. They should be formalized into schemas only when the corresponding implementation phase begins.

### SourceArtifact

```json
{
  "sourceType": "slack|gmail|docs|sheets|jira",
  "sourceId": "provider-stable-id",
  "url": "https://...",
  "title": "Human readable source title",
  "capturedAt": "ISO timestamp",
  "contentHash": "sha256",
  "owner": "person or team",
  "rawSummary": "short source summary",
  "provenanceLocator": "thread ts, doc heading, sheet row, jira key, etc."
}
```

### GraphNode

```json
{
  "nodeId": "node:stable-id",
  "nodeType": "Project",
  "name": "Human readable name",
  "status": "current state",
  "properties": {},
  "sourceRefs": [],
  "updatedAt": "ISO timestamp"
}
```

### GraphEdge

```json
{
  "edgeId": "edge:stable-id",
  "sourceNodeId": "node:a",
  "targetNodeId": "node:b",
  "edgeType": "depends_on",
  "confidence": 0.9,
  "sourceRefs": [],
  "updatedAt": "ISO timestamp"
}
```

### EmbeddingChunk

```json
{
  "chunkId": "chunk:stable-id",
  "sourceRef": {},
  "textHash": "sha256",
  "textPreview": "short preview only",
  "embeddingModel": "model/version",
  "vectorRef": "file offset or provider ID",
  "metadata": {}
}
```

## Trust, Security, And Governance

The current acceptable security posture is owner-executed automation for controlled internal workflows.

Before adding broad query/chat access, the architecture must add source-aware access control so the assistant does not reveal information a user could not access in the original tool.

Minimum governance rules:

- external actions require explicit approval unless a future proposal narrows the scope safely
- source mutations require provenance and audit records
- low-confidence extraction creates an ambiguity item, not a confirmed fact
- conflicting source truth creates a reconciliation item
- every generated recommendation should be traceable to source references
- future model prompts and tool outputs should use strict JSON contracts

## Roadmap

1. **Current module:** keep hardening the Control Center Communication App.
2. **Architecture contracts:** document storage, graph, embedding, connector, and skill contracts before implementation.
3. **Storage foundation:** implement Drive JSON storage behind `StoragePort`.
4. **Graph foundation:** implement Drive JSON graph read/write/validate skills.
5. **Embedding foundation:** implement Drive-hosted chunk/vector index and query skills.
6. **Slack + Docs sensors:** ingest Slack threads and Google Docs/Sheets artifacts into `SourceArtifact` records.
7. **Normalization + reconciliation:** extract decisions, risks, timeline changes, and ambiguity items with provenance.
8. **Graph-aware communication:** use graph/evidence context to improve Communication App drafts and readiness.
9. **Reasoning layer:** semantic query, dependency collision detection, forecasting, and trade-off simulation.
10. **Command Deck:** visualize graph, confidence, risks, source evidence, and recommended actions.

## How To Use This North Star

- Every future feature proposal should name the target layer and skill family.
- Every implementation plan should reference the relevant section of this document.
- No future work should bypass the atomic skill boundary unless the proposal explicitly justifies the exception.
- Current docs should continue to distinguish live implementation from future architecture.
- This document should be updated when a future phase makes a north-star piece real.

## Explicit Non-Goals For Now

- No new runtime is implemented by this document.
- No Drive JSON storage, graph file, embedding index, connector, sensor, Jira sync, Gmail sync, Docs scraper, RAG, forecasting, or autonomous orchestrator is live because of this document.
- No existing Communication App behavior changes.
