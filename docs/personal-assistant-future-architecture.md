# Personal Assistant Future Architecture

This document captures the broader AI-first Personal Assistant roadmap. It is architecture documentation only.

The only current implementation is the communication automation under `personal-assistant/`.

## Current Scope

| Capability | Status |
| --- | --- |
| Executive communication automation | Current implementation |
| Slack anchors, threads, review, and approval | Current implementation |
| Registry-driven templates, routing, and flow transitions | Current implementation |
| Google Drive BYOS storage | Future / Not Implemented |
| Knowledge Graph Sandbox | Future / Not Implemented |
| Proactive Logistics Orchestrator | Future / Not Implemented |
| Personal Data Trackers | Future / Not Implemented |
| Browser BYOK local RAG | Future / Not Implemented |
| Stateless LLM gateway | Future / Not Implemented |
| Proactive worker / daily automation engine | Future / Not Implemented |

## Future Product Model

Personal Assistant may eventually become a modular suite of personal utility applications that use the user's own storage and workspace tools instead of a centralized product database.

Potential future modules:

- Knowledge Graph Sandbox for notes, links, and relationship visualization.
- Proactive Logistics Orchestrator for tasks, timelines, and reminders.
- Personal Data Trackers for lightweight structured logging.
- Executive Communication for visibility, review, approval, and Slack publication. This is the first live module.

## Future Data Sovereignty Model

The target storage model is Bring Your Own Storage:

- User-owned Google Drive folders hold personal content, markdown files, graphs, and configuration.
- Browser-based clients read and write directly to Google APIs with user OAuth.
- The central service does not become the system of record for user-generated content.
- Backend services process sensitive data only when explicitly needed for premium or protected capabilities.

This storage model is not implemented in the current repo.

## Future Hidden Gateway

The future gateway may protect proprietary prompt chains, subscription checks, and server-side AI workflows.

Expected principles:

- Process requests in memory only.
- Avoid storing or caching user-generated content.
- Keep subscription, licensing, and protected prompts outside the visible client.
- Return structured results to the client without becoming a database.

No live LLM gateway, Stripe integration, or protected prompt service exists in the current implementation.

## Future Local AI Model

Future personal-data workflows should prefer local browser execution when possible:

- User-owned API keys remain browser-local.
- Document parsing, chunking, graph layout, and similarity search run in client-side code.
- LLM-driven state changes use strict JSON tool commands instead of free-form text.

This is intentionally separate from the current communication automation, which uses Apps Script, Sheets, and Slack.

## Implementation Guardrail

Do not build the future suite until the current Personal Assistant communication automation is stable enough to act as the first reliable module.

Future implementation work should start with a new proposal that defines storage, auth, module boundaries, UI runtime, and privacy constraints before adding code.
