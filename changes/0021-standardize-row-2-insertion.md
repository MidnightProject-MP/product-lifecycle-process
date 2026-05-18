# Change Proposal 0021: Standardize Row 2 Insertion

## Problem

Google Sheets Tables can make the POC much easier to read and operate, but script-driven bottom appends can behave poorly with table auto-expansion, filters, typed columns, and footer rows.

## Proposal

Adopt a repo-wide spreadsheet write convention:

- Row 1 is the schema header.
- New script-created records are inserted at row 2.
- Scripts do not append records to the bottom of sheets.
- Records are identified by stable IDs, not by row position.
- Bulk refresh tabs may clear and rewrite data starting at row 2, but should not rely on bottom append behavior.

## Expected Impact

- Newest operational records are always visible at the top.
- Human-facing tabs can use the Google Sheets Table feature more safely.
- Scripts avoid Table auto-expansion edge cases.
- The convention is consistent across Hub, Registry, Automation, and Dashboard scripts.

## Risks

- Existing sheets using oldest-first ordering may need expectations adjusted.
- Any future code that assumes latest records are at the bottom would be incorrect.

## Adoption Notes

When adding a row-writing helper, name it around insertion rather than append behavior and use row 2 as the insertion point.
