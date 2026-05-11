# Change Proposal 0017: Leadership Dashboard to Automation Sync

## Problem

The Automation Dashboard schema exists, but there is no script yet to pull data from the leadership-facing dashboard and normalize it into the automation layer.

## Proposal

Add `syncLeadershipDashboardToAutomation()` to the Automation Dashboard Apps Script.

The sync:

- Reads configured project, gate, and release ranges from the leadership dashboard.
- Normalizes rows into `Projects_Normalized`, `Gates_Normalized`, and `Releases_Normalized`.
- Computes state hashes.
- Records snapshots.
- Logs trigger candidates.

## Expected Impact

- The leadership dashboard remains presentation-friendly.
- Automation can work against stable normalized fields.
- Trigger evaluation can be tested before creating Hub drafts.

## Risks

- Source row mappings are approximate and may need tuning against the real dashboard layout.
- The release and gate parsers are conservative and may need refinement.
- Snapshot volume will grow until cleanup rules are added.

## Adoption Notes

Start by running the sync manually and reviewing normalized rows and trigger logs. Add scheduled polling only after the mapping is validated.

