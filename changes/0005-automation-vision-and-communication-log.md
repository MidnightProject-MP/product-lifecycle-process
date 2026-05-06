# Change Proposal 0005: Automation Vision and Communication Log

## Problem

The repository needs to reflect the target operating model: dashboard updates should trigger an automated flow that logs potential communications and eventually sends Slack messages using templates.

## Proposal

Add:

- Automation vision.
- Communication control log definition.
- Communication control log CSV template.
- Slack message templates for status updates, risk updates, escalations, and release updates.

## Expected Impact

- The repo now describes the actual future-state process, not only static documentation.
- Dashboard updates become the trigger point for communication.
- TPM dashboard ownership is connected directly to stakeholder communication.
- Future automation can be built against stable fields and templates.

## Risks

- Automation could send too much noise if trigger rules are not tuned.
- Automation could create false confidence if dashboard data is stale or inaccurate.
- High-risk communications need human review until approval rules are proven.

## Adoption Notes

Start with manual dashboard updates and logged communication candidates. Move to automated Slack sending only after trigger quality and templates are tested.

