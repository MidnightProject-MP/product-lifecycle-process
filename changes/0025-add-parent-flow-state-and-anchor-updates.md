# Change Proposal 0025: Add Parent Flow State and Anchor Updates

## Problem

The Hub currently treats each communication row as an independent item. That is not enough for incidents, releases, and projects that move through a lifecycle with multiple updates.

For example:

- A critical incident starts as `incident.critical.identified`.
- It should then move through investigation, fix, QA, ready-for-release, and closure updates.
- Detours such as delay, regression, or failed fix should stay under the same parent communication item.
- Slack should show one live parent message plus a threaded history.

## Proposal

Introduce a parent/child communication model:

- `Flow_State` in the Hub stores the parent communication state.
- `History` stores child update records.
- The first event creates a Slack anchor message.
- Subsequent events post a reply in the same Slack thread and update the anchor message.
- Registry `Event_Transitions` defines the next expected happy-path event and allowed sad-path detours.
- Scheduled next-step drafts are retired when a detour makes them stale.

## Slack Behavior

Initial event:

1. `chat.postMessage` creates a new parent message.
2. Hub stores channel, anchor timestamp, thread timestamp, and permalink in `Flow_State`.

Subsequent event:

1. Hub resolves the parent by `Flow ID`.
2. `chat.postMessage` posts the update using the parent timestamp as `thread_ts`.
3. `chat.update` updates the parent message with the latest executive summary.
4. Hub stores the reply timestamp and updated flow state.

## Flow State

`Flow_State` should track:

- Flow identity and subject.
- Current event key and path.
- Next expected happy-path event.
- Allowed sad-path detours.
- Return event after detour.
- Slack anchor channel and timestamp.
- Latest reply timestamp.
- Latest payload snapshot.

## Transition Rules

`Event_Transitions` should define:

- Current event key.
- Next happy event key.
- Allowed sad-path event keys.
- Return event key.
- Whether the event is terminal.
- Whether the next draft should be auto-queued.
- Optional delay before queuing or nudging.

## Expected Impact

- Executives see one current-state Slack anchor per incident/release/project.
- Operators and engineers can inspect threaded history.
- Happy-path and sad-path updates remain connected.
- Future AI nudge behavior has a clear state machine to reason from.

## Risks

- Anchor update failures must not erase thread history.
- Flow sequencing must use stable IDs, not sheet row numbers.
- Transition rules should live in the Registry, not hardcoded in Hub scripts.
