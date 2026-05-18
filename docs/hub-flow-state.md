# Hub Flow State

The Hub must distinguish between a communication flow and an individual communication update.

## Core Model

| Concept | Meaning |
| --- | --- |
| Flow | The parent communication item: one incident, one release, one project lifecycle thread, or one major escalation. |
| Update | A child communication event inside that flow: investigating, fix in QA, release started, release delayed, rollback, resolved, etc. |
| Anchor | The parent Slack message that always shows the latest executive-facing state. |
| Thread Reply | The child Slack message that records the detailed update history under the anchor. |

## Slack Behavior

Initial flow event:

1. Post a new Slack message.
2. Store its channel and timestamp as the flow anchor.
3. Post a compact version of the same event as the first reply in the anchor thread so the historical trail has a child entry from the start.
4. Store the anchor timestamp as the thread timestamp.
5. Record the first expected happy-path next event.

Subsequent flow update:

1. Resolve the parent flow by `Flow ID`.
2. Post the update as a Slack thread reply using the anchor timestamp as `thread_ts`.
3. Update the original anchor message with the latest executive summary using `chat.update`.
4. Record the child update in `History`.
5. Advance or adjust the expected next event.
6. Retire any scheduled child draft that no longer matches the current flow state.

Slack supports this through `chat.postMessage` with `thread_ts` for thread replies and `chat.update` for editing the anchor message.

## Flow State Sheet

Add a Hub-managed `Flow_State` sheet.

| Field | Purpose |
| --- | --- |
| `Flow ID` | Stable parent identity. |
| `Flow Type` | Project, Incident / Bug, Production Release, Stray Story. |
| `Subject` | Human-readable title. |
| `Owner` | Current accountable communication owner. |
| `Flow Status` | Active, Completed, Paused, Error. |
| `Current Event Key` | Most recent event sent/logged for this flow. |
| `Next Happy Event Key` | Expected next event if the flow continues normally. |
| `Allowed Detour Event Keys` | Comma-separated detour events that can interrupt the happy path. |
| `Return Event Key` | Expected event that returns the flow from a detour back to the happy path. |
| `Slack Channel` | Channel where the anchor lives. |
| `Anchor Message TS` | Slack timestamp of the parent message. |
| `Thread TS` | Slack thread timestamp, usually same as anchor timestamp. |
| `Latest Reply TS` | Slack timestamp of the latest child reply. |
| `Anchor Message URL` | Permalink for the parent anchor. |
| `Last Queue ID` | Most recent Queue item processed for this flow. |
| `Last Confirmed At` | Last successful send/log timestamp. |
| `State JSON` | Latest normalized flow-state snapshot. |
| `Updated At` | Last state update timestamp. |

## Registry Transition Rules

Add a Registry-managed `Event_Transitions` table.

| Field | Purpose |
| --- | --- |
| `Event Key` | Current event. |
| `Next Happy Event Key` | Default next event after this one. |
| `Allowed Sad Path Event Keys` | Events that can interrupt the happy path. |
| `Return Event Key` | Event expected after the sad-path detour is resolved. |
| `Flow Terminal` | TRUE when this event closes the flow. |
| `Auto Queue Next` | TRUE when the Hub should prepare the next expected draft. |
| `Default Delay Minutes` | Optional delay before queuing or nudging for the next event. |
| `Active` | Whether the transition rule is active. |

## Draft Contract Changes

Each Queue row still represents one update, but the visible Queue remains lean. Parent-flow context that is not part of the Queue v2 header lives in `Payload JSON`.

- `Flow ID`
- `Event Key`
- `Parent Queue ID` when the update was spawned from a prior Queue row
- `Expected Previous Event Key` when sequence matters
- `Path Override` for sad-path detours
- `Scheduled For` for planned happy-path drafts or nudges
- `Payload JSON`

## Lifecycle Behavior

Happy path:

```text
Start event -> next happy event -> next happy event -> terminal event
```

Sad path detour:

```text
Current happy-path state
        |
        v
Unexpected sad-path event
        |
        v
Recovery / return event
        |
        v
Resume happy path
```

The flow never loses its parent anchor. All child updates stay under the same Slack thread, and the anchor is edited to show the latest executive state. The anchor carries the full current-state summary; thread replies are compact timeline entries with the step, key update, impact, next action, and owner.

If a sad-path update interrupts a previously scheduled happy-path draft, the Hub archives the stale scheduled draft and prepares the new expected return event when the Registry transition rule allows it.

## PM Flow Console

PMs should drive manual lifecycle updates from `Flow_Console`, not by editing technical Queue fields.

The console exposes:

- `Flow ID` to select the active incident, release, or project flow.
- Read-only current state, expected next step, and available detours.
- `Action` with simple choices: continue expected path, report delay, report rollback, or request postmortem.
- Three writing prompts: what changed, why it matters, and what happens next.
- Owner and priority.

When the PM creates a draft from the console, the Hub resolves the right `Event Key`, creates or updates the matching Queue draft, refreshes `Review`, and retires stale scheduled happy-path drafts when a detour is chosen.

## Implementation Order

1. Add `Flow_State` and `Event_Transitions` schemas.
2. Teach Hub sending to create or update `Flow_State`.
3. Add Slack `chat.update`.
4. Change subsequent sends to post reply + update anchor.
5. Add transition-rule lookup for next happy-path and sad-path events.
6. Add scheduled next-draft creation or nudge behavior.
