# Personal Assistant

Personal Assistant is a product workspace for turning operational noise into clear, executive-ready communication.

The first live capability is the Sheets, Apps Script, and Slack communication automation that creates, reviews, test-sends, sends, and traces project, incident, release, and intake updates. New deployments should use the consolidated **Personal Assistant Control Center** spreadsheet; the older split Hub, Registry, and Automation Dashboard projects remain in the repo as fallback.

The broader AI-first personal app suite is documented as future architecture only. This repo does not yet implement a React app, Google Drive BYOS storage, active graph/RAG tooling, BYOK settings, proactive workers, or an LLM gateway.

## Current Capability

```text
Source update or Slack command
        |
        v
Control Center validates a values-only dashboard export and compares state
        |
        v
Local Registry tabs resolve template, routing, and approval policy
        |
        v
Control Center queues draft and records observability
        |
        v
PM tests or approves in Communication Console
        |
        v
Slack anchor and thread are updated
```

The current automation is designed to make strong PM behavior the default:

1. Communicate proactively so stakeholders always know where things stand.
2. Pull requirements from the business instead of waiting to be handed a spec.
3. Hold the process line and push back when work is not ready to build.
4. Build strong cross-functional trust across product, engineering, and business.
5. Take ownership, grow into problems, and manage up when needed.

## Repository Map

- `personal-assistant/`: Current Personal Assistant implementation using Google Sheets, Apps Script, Slack, Registry, Hub, Flow State, and approval.
- `personal-assistant/setup.md`: Step-by-step setup and configuration guide.
- `personal-assistant/google-apps-script/`: clasp-managed Apps Script projects.
- `personal-assistant/schemas/`: Spreadsheet schemas and starter rows.
- `docs/personal-assistant-current-architecture.md`: Current implementation boundaries and operating model.
- `docs/personal-assistant-future-architecture.md`: Future suite roadmap and non-implemented architecture.
- `docs/personal-assistant-skills.md`: Internal atomic skill catalog for callable Personal Assistant actions.
- `docs/control-center-consolidation.md`: Consolidated one-spreadsheet Control Center setup and cutover model.
- `docs/passive-graph-memory.md`: Passive W-Graph memory layer under the current communication workflow.
- `docs/principles.md`: Core PM operating principles.
- `docs/lifecycle.md`: Lifecycle stages and stage gates.
- `docs/ownership-model.md`: Ownership expectations and role map.
- `docs/communication-model.md`: Communication cadence, status standards, and escalation paths.
- `docs/communication-event-catalog.md`: Event catalog defining unique communication events by lane.
- `docs/communication-matrix.md`: Automation-ready matrix mapping each communication event to one trigger and one template path.
- `docs/automation-vision.md`: Target automation process from dashboard update to Slack communication.
- `docs/slack-anchor-nudge-architecture.md`: Target Slack Anchor, private triage, and stale-update nudge model.
- `templates/`: Reusable process artifacts.
- `scripts/validate-gas-folders.mjs`: Local and CI validation for clasp-managed Apps Script folders.
- `decisions/`: Product and process decision records.
- `changes/`: Proposed process changes.

## How to Change This Product

1. Create a proposal in `changes/`.
2. Explain the problem, proposed change, expected impact, and risks.
3. Review with affected stakeholders.
4. If accepted, update the relevant docs, templates, schemas, or Apps Script files.
5. Record major decisions in `decisions/`.
