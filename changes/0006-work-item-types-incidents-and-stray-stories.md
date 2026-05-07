# Change Proposal 0006: Work Item Types, Incidents, and Stray Stories

## Problem

The communication model needs to support more than projects. Incidents / bug reports and stray stories require different trigger logic and communication behavior.

## Proposal

Add:

- Work item type definitions for projects, incidents / bug reports, and stray stories.
- Incident and bug communication rules.
- Critical bug leadership communication requirements.
- Stray story weekly prioritization process.
- Slack templates for critical bug leadership updates and stray story disposition updates.
- CSV templates for incident communication and stray story prioritization.

## Expected Impact

- Critical bugs receive appropriate leadership-level communication.
- Stray stories are reviewed consistently instead of becoming unmanaged work.
- The automation model can route communications differently by work item type.

## Risks

- Severity definitions may need tuning once real incident examples are reviewed.
- Stray story prioritization can become too heavy if every small request requires excessive documentation.
- Leadership communication should be timely but not noisy.

## Adoption Notes

Start with manual classification of work item type. Once patterns are stable, automation can classify items based on source, severity, dashboard fields, and prioritization meeting outputs.

