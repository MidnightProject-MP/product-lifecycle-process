# Change Proposal 0029: Communication Console Simplification and Manual Sync

## Summary

Make the Communication Console the PM front door, reduce normal exposure to internal Hub sheets, add a manual dashboard sync action from the Console, and prepare for a future single Control Center spreadsheet.

## Changes

- Hub menu now exposes `Open Communication Console` and `Open Communication Console Wide` as the normal PM actions.
- Direct `Queue`, `Review`, and `Flow_Console` operations move under `Admin / Debug`.
- Communication Console adds `Sync Dashboard Now`.
- Automation Dashboard adds a token-protected internal `doPost` endpoint for manual sync.
- Automation logic is split into smaller GAS files by responsibility while preserving public entrypoints.
- Local tests cover Slack formatting conversion, dashboard trigger inference, and the sync endpoint.
- Control Center consolidation is documented as plan/prep only; no live spreadsheet merge happens in this change.
- Graph behavior stays passive and unchanged.

## Rollout Notes

- Set `AUTOMATION_SYNC_TOKEN` in both Hub and Automation Script Properties.
- Deploy the Automation Dashboard script as a Web App and set the Hub `AUTOMATION_SYNC_WEB_APP_URL` property.
- The temporary endpoint can be removed after Hub and Automation are consolidated into one Control Center script.

## Validation

- `npm run validate:gas`
- `npm run validate:gas:strict`
- `npm test`
