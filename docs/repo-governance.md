# Repository Governance

This repository is the source of truth for the product lifecycle ownership and communication process.

## Governance Principles

- The process is versioned and reviewable.
- Changes are proposed before they become default practice.
- Owners are accountable for keeping the process useful and current.
- Major decisions are recorded.
- Templates are treated as product artifacts and improved through usage.
- Process overhead must be justified by better clarity, readiness, trust, or execution quality.

## Recommended Branch Protection

Configure the default branch with:

- Pull request required before merge.
- At least one approving review.
- Code owner review required when CODEOWNERS is populated.
- Conversation resolution required before merge.
- Linear history preferred when practical.
- Force pushes disabled.
- Branch deletion disabled.

## Recommended Repository Settings

- Default branch: `main`.
- Squash merge: enabled.
- Merge commits: enabled for explicit history joins and major baselines.
- Rebase merge: optional.
- Issues: enabled.
- Projects: optional for process roadmap.
- Wiki: disabled unless the team intentionally uses it.

## Maintainer Responsibilities

Maintainers are responsible for:

- Reviewing process changes for clarity and adoption risk.
- Keeping templates current.
- Making sure ownership rules do not drift from reality.
- Retiring outdated guidance.
- Publishing stable baselines.
- Gathering feedback from PMs, Engineering, and business stakeholders.

## Review Roles

Use this model for process changes:

| Role | Responsibility |
| --- | --- |
| Driver | Authors the change and drives it to closure. |
| Approver | Makes the final decision for the change. |
| Contributors | Provide input, alternatives, and implementation details. |
| Informed | Need to know the change happened but do not approve it. |

For broad operational changes, use DACI-style decision clarity. For task-level ownership, use RACI-style responsibility clarity.

## Release Baselines

Create a release baseline when the process is stable enough for team adoption.

Each release should include:

- Version tag.
- Summary of major changes.
- Adoption notes.
- Known gaps.
- Owner for next review.

