# Automation Dashboard Schema

The Automation Dashboard is the middle layer between the stakeholder-facing Executive Dashboard and the Personal Assistant Hub.

It should be optimized for scripts and trigger logic, not presentation.

The automation script is intentionally owned outside the Executive Dashboard. It opens the leadership-facing spreadsheet by ID, which keeps code ownership and script visibility separate from the presentation sheet owner.

```text
Leadership Executive Dashboard
        |
        v
Automation Dashboard
        |
        v
Personal Assistant Hub
        |
        v
Slack
```

## Recommended Tabs

| Tab | Purpose |
| --- | --- |
| `Projects_Normalized` | Normalized project rows from the executive dashboard project table. |
| `Gates_Normalized` | Normalized phase gate rows from the executive dashboard phase gates section. |
| `Releases_Normalized` | Normalized release activity rows from the executive dashboard release activity section. |
| `Snapshots` | Prior state records used to compare old state vs new state. |
| `Trigger_Log` | Audit trail of detected trigger candidates and Hub draft creation attempts. |
| `Config` | Non-secret integration configuration for source sheet names, start rows, and gate lead times. |

## Source Mapping

Based on the current Executive Dashboard layout:

| Source Section | Approximate Source Rows | Automation Tab |
| --- | --- | --- |
| Project status table | Row 3 onward | `Projects_Normalized` |
| Phase Gates | Row 24 onward | `Gates_Normalized` |
| Release Activity | Row 57 onward | `Releases_Normalized` |

These row ranges are configurable in the Automation Dashboard `Config` tab:

- `LEADERSHIP_SPREADSHEET_ID`
- `HUB_SPREADSHEET_ID`
- `CREATE_HUB_DRAFTS`
- `PROJECTS_START_ROW`
- `PROJECTS_END_ROW`
- `GATES_START_ROW`
- `GATES_END_ROW`
- `RELEASES_START_ROW`
- `RELEASES_END_ROW`

## Sync Function

The Automation Dashboard Apps Script provides:

```text
syncLeadershipDashboardToAutomation
```

This function:

1. Opens the leadership dashboard using `LEADERSHIP_SPREADSHEET_ID`.
2. Reads configured source ranges.
3. Normalizes project, gate, and release rows.
4. Writes normalized rows into the Automation Dashboard.
5. Records snapshots.
6. Logs trigger candidates.
7. Creates Hub queue drafts when `CREATE_HUB_DRAFTS` is `TRUE`.

## Projects_Normalized

Use this for project status and weekly digest logic.

Key fields:

- `Flow ID`: stable project flow identifier.
- `Current State Hash`: hash of current normalized row.
- `Previous State Hash`: prior hash from last processed state.
- `Trigger Candidate`: detected trigger before Hub draft creation.
- `Event Key`: Registry event key, such as `project.unexpected_status_change`.
- `Dedupe Key`: prevents duplicate Hub drafts.
- `Hub Queue ID`: queue row created in the Hub.
- `Processing Status`: pending, processed, skipped, or error.

## Gates_Normalized

Use this for gate approaching, passed, missed, failed, or delayed communication.

Key fields:

- `Days Until Target`
- `Is Gate Approaching`
- `Is Gate Missed`
- `Gate Status`
- `Previous Gate Status`
- `Event Key`

## Releases_Normalized

Use this for production release communication.

This normalizes the presentation-friendly Release Activity section into one row per release event.

Key fields:

- `Release ID`
- `Release Event Key`
- `Normalized Release Status`
- `Go / No-Go Required`
- `Slack Thread ID`
- `Event Key`

## Snapshots

The snapshot table stores the last known state for comparison.

The script should:

1. Build a normalized row.
2. Create `State JSON`.
3. Hash `State JSON` after excluding volatile operational fields such as processing status and timestamps.
4. Compare to the previous snapshot.
5. If changed, evaluate trigger rules.

## Trigger_Log

The trigger log records what the automation saw and what it did.

Use it to debug:

- Why a Hub draft was created.
- Why a change was skipped.
- Whether dedupe suppressed a duplicate.
- Whether Hub draft creation failed.
