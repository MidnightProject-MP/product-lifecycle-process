# Change Proposal 0015: Automation Dashboard Schema

## Problem

The executive dashboard is optimized for stakeholder presentation, not automation. The POC needs a middle spreadsheet schema that normalizes project, gate, and release data before creating Hub draft communications.

## Proposal

Add schemas for:

- `Projects_Normalized`
- `Gates_Normalized`
- `Releases_Normalized`
- `Snapshots`
- `Trigger_Log`
- `Config`

Also add documentation explaining how the current Executive Dashboard maps into the automation layer.

## Expected Impact

- The leadership dashboard can remain presentation-friendly.
- Automation logic gets stable IDs, hashes, dedupe keys, and processing status fields.
- Hub draft creation becomes more reliable and easier to debug.

## Risks

- The exact source row ranges may need adjustment if the executive dashboard layout changes.
- Normalization scripts still need to be built against this schema.

## Adoption Notes

Use this schema for the middle spreadsheet before wiring additional script logic to the stakeholder-facing dashboard.

