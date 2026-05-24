# Change Proposal 0031: Control Center Clean Sheet

## Summary

Create a new consolidated Personal Assistant Control Center spreadsheet and Apps Script project instead of migrating old Hub, Registry, and Automation Dashboard data.

## Proposed Change

- Add a new `control-center` Apps Script folder.
- Merge Hub, Registry, and Automation behavior into one local script project.
- Keep the old split projects available as fallback during cutover.
- Retire cross-spreadsheet Registry and Hub IDs in the new Control Center.
- Omit graph memory from consolidated v1.

## Expected Impact

PMs use one spreadsheet and one Communication Console for sync, test send, review, queue, and live send. Setup becomes simpler because Registry, Automation, Queue, Flow_State, and logs live together.

## Risks

- The new Control Center needs a new bound Apps Script project ID before strict deployment validation can pass.
- Existing split spreadsheets must stay available until one real-data sandbox acceptance test passes.
