# Product Lifecycle Ownership and Communication

This repository defines how product work moves from business need to shipped outcome, and how ownership and communication are expected to operate along the way.

It also defines the future automated process for turning project dashboard updates into stakeholder communication.

Target flow:

```text
TPM updates dashboard
        |
        v
Automation compares old state to new state
        |
        v
Trigger rules log potential communications
        |
        v
Templates generate Slack-ready messages
        |
        v
Approved messages are sent and archived
```

The process is managed like a codebase:

- Changes are proposed, reviewed, and versioned.
- Ownership is explicit.
- Templates are reusable source files, not one-off documents.
- Process decisions are recorded.
- The system improves through small, deliberate changes.

## Goals

The process is designed to make strong PM behavior the default:

1. Communicate proactively so stakeholders always know where things stand.
2. Pull requirements from the business instead of waiting to be handed a spec.
3. Hold the process line and push back when work is not ready to build.
4. Build strong cross-functional trust across product, engineering, and business.
5. Take ownership, grow into problems, and manage up when needed.

## Repository Map

- `docs/principles.md`: Core PM operating principles.
- `docs/lifecycle.md`: Lifecycle stages and stage gates.
- `docs/ownership-model.md`: Ownership expectations and role map.
- `docs/ownership-matrix.md`: Phase accountability and supporting delivery ownership matrix.
- `docs/communication-model.md`: Communication cadence, status standards, and escalation paths.
- `docs/communication-matrix.md`: Rules matrix for lane, trigger, timing, payload, audience, template, and send behavior.
- `docs/communication-matrix-rules.md`: Evaluation order, lane precedence, bundling, and approval rules.
- `docs/communication-triggers.md`: Trigger model for when communication is needed.
- `docs/project-communication.md`: Simplified project communication rules for weekly digest and unexpected status changes.
- `docs/automation-vision.md`: Target automation process from dashboard update to Slack communication.
- `docs/executive-dashboard.md`: Executive dashboard field definitions.
- `docs/communication-control-log.md`: Log structure for generated communication candidates.
- `docs/work-item-types.md`: Project, incident / bug report, and stray story communication lanes.
- `docs/incident-communication.md`: Severity-based incident and bug communication rules.
- `docs/release-communication.md`: Production release communication, bundling, go / no-go, execution, rollback, and postmortem rules.
- `docs/stray-story-prioritization.md`: Weekly prioritization process for stray stories.
- `templates/`: Reusable process artifacts.
- `decisions/`: Process decision records.
- `changes/`: Proposed process changes.

## How to Change This Process

1. Create a proposal in `changes/`.
2. Explain the problem, proposed change, expected impact, and risks.
3. Review with affected stakeholders.
4. If accepted, update the relevant docs or templates.
5. Record major decisions in `decisions/`.
