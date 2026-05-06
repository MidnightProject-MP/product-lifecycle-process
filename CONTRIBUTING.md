# Contributing

This process is managed like a product codebase. Changes should be explicit, reviewed by the right owners, and sized to the risk of the change.

## Change Philosophy

Prefer small, clear changes over large rewrites. Every change should improve one of these outcomes:

- PMs communicate status, risks, decisions, and next steps proactively.
- Business needs are discovered and clarified before work is defined.
- Engineering receives work that is ready enough to build.
- Cross-functional partners understand their role and trust the process.
- PMs own outcomes, manage up, and escalate constructively.

## Change Types

| Type | Examples | Required Review |
| --- | --- | --- |
| Documentation | Clarifying wording, fixing broken links, improving examples. | Process owner. |
| Template | Product brief, status update, readiness checklist, decision record. | Process owner and one active PM. |
| Lifecycle | Stage definitions, gates, Definition of Ready, launch rules. | Product leadership, Engineering leadership, and affected function leads. |
| Ownership | Role accountability, RACI/DACI model, escalation paths. | Product leadership and affected function leads. |
| Governance | Review rules, versioning, adoption, repository structure. | Process owner and executive sponsor. |

## Proposal Standard

Use a change proposal when the change affects how teams work, who owns decisions, required artifacts, or lifecycle gates.

A good proposal includes:

- Problem being solved.
- Current pain or risk.
- Proposed change.
- Alternatives considered.
- Expected impact.
- Rollout plan.
- Risks or tradeoffs.
- Owners who need to review.

## Pull Request Standard

Every pull request should include:

- What changed.
- Why it changed.
- Who is affected.
- How adoption should happen.
- Any open questions or risks.

Avoid bundling unrelated process changes in one pull request. If a change touches both lifecycle rules and templates, explain the dependency clearly.

## Review Standard

Reviewers should check:

- The change supports the operating principles.
- The change is understandable by PMs, Engineering, and business partners.
- Ownership and decision rights are clear.
- Required artifacts are useful enough to justify their overhead.
- The change can be adopted consistently.
- Risks, exceptions, and escalation paths are explicit.

## Decision Records

Use a decision record for major process decisions that people may question later. Decision records should capture the context, options, decision, rationale, impact, and follow-up ownership.

## Versioning

Use semantic-style process versions:

- Major version: material change to lifecycle stages, ownership model, or governance.
- Minor version: new template, new stage gate, or meaningful workflow improvement.
- Patch version: wording, examples, formatting, or small clarifications.

Tag stable baselines as `v0.1`, `v0.2`, `v1.0`, and so on.

## Adoption Rule

Do not add process for its own sake. Add only the minimum structure needed to improve clarity, readiness, trust, or decision quality.

