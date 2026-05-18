# Change Proposal 0019: Centralize POC Registry and Simplify Hub

## Problem

The initial POC mixed templates, channel defaults, queue state, and send execution in the Hub. That made the system harder to govern, harder to observe, and easier to misconfigure.

## Proposal

Introduce a central `Communication Registry` spreadsheet that owns:

- Event catalog.
- Template text and versions.
- Required template variables.
- Slack channel defaults in Settings key/value rows.
- Approval rules.
- Non-secret message policy settings.

Simplify the Hub to:

- `Queue`
- `History`
- `Run_Log`

Each queue row should use:

```text
Event Key + Flow ID + Dedupe Key + Payload JSON
```

The Hub sender resolves templates, channel settings, post mode, send rule, and validation from the Registry.

## Expected Impact

- Less duplicated configuration.
- Cleaner manual review surface.
- Fewer hardcoded message decisions in Apps Script.
- Better traceability from dashboard source state to trigger log to queue row to Slack message.
- A stronger stepping stone toward a standalone product.

## Risks

- `REGISTRY_SPREADSHEET_ID` becomes a required bootstrap property for the Hub.
- Existing Hub spreadsheets with local `Templates` and `Config` tabs need migration.
- Manual queue entries now require valid payload variables for the chosen event key.

## Adoption Notes

1. Create the Registry spreadsheet and run `setupRegistrySheets()`.
2. Fill Registry `Settings` channel ID values such as `DEFAULT_PROJECT_CHANNEL`.
3. Set Hub Script Property `REGISTRY_SPREADSHEET_ID`.
4. Run `setupHubSheets()` to enforce the compact Hub schema.
5. Use `Event Key` and `Payload JSON` for manual drafts.
