# Change Proposal 0018: Add Hub Run Logging

## Problem

The Hub trigger can complete without visible output when a row is skipped or when a send fails in a way that is not obvious to the user.

## Proposal

Add a `Run_Log` tab and logging throughout the Hub Apps Script:

- Edit trigger detection.
- Skip reasons.
- Template lookup.
- Template default application.
- Slack send attempts.
- Slack API errors.
- History copy.
- General send failures.

Also add `debugSendQueueRow(rowNumber)` for manual testing.

## Expected Impact

- POC testing becomes easier to diagnose.
- Silent trigger runs can be traced.
- Slack/API/config/template issues become visible in the sheet.

## Risks

- Logs may grow quickly during testing.
- The POC logger is intentionally simple and not a production observability system.

## Adoption Notes

Check `Run_Log` first whenever an approved queue row does not send.

