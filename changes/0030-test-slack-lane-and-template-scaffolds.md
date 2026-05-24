# Test Slack Lane And Template Scaffolds

## Problem

PMs need a low-risk way to see Slack output before approving a real communication. The current sandbox channel is effectively the test channel, but the Hub has only one set of Slack timestamps.

Templates also became too influential once the Console switched to direct final-message editing. They should provide first-draft structure, not pretend to be final copy.

## Proposed Change

- Add test Slack routing keys in Registry Settings.
- Add a Console action to send the selected draft to Slack test routing without consuming the Queue row.
- Automatically send newly queued drafts to test routing by default, while keeping them available for real approval/send.
- Track test Slack channel, thread timestamp, message timestamp, permalink, and sent-at metadata separately from live Slack metadata.
- Convert Registry template seeds into scaffold-style first drafts with explicit prompts for PM editing.
- Disable passive graph writes by default until the graph powers a visible feature.

## Expected Impact

PMs can use the Communication Console as the single workflow: sync, review/edit, send test, queue, and approve/send.

The system can compare test and live state cleanly because the metadata no longer shares fields.

Template maintenance becomes less sensitive because templates only shape the initial draft.

## Risks

Automatic test sends can create sandbox noise if dashboard changes produce many drafts. Set `AUTO_SEND_TEST_ON_QUEUE = FALSE` in Hub Script Properties to disable.

Existing Registry templates are not overwritten by normal setup unless `refreshTemplateScaffolds` is run.
