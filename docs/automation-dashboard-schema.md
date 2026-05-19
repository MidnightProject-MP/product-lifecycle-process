# Automation Dashboard Schema

The Automation Dashboard is the owned adapter between the stakeholder-facing Executive Dashboard and the Personal Assistant Hub.

The Executive Dashboard remains free-form and externally owned. The Automation Dashboard owns formulas, validation, snapshots, evidence, trigger decisions, and Hub draft creation.

```text
Executive Dashboard
        |
        v
Raw formula tabs in Automation Dashboard
        |
        v
Automation_Export_Source
        |
        v
Automation_Export
        |
        v
Dashboard evidence + Hub drafts
```

## Current Tabs

| Tab | Purpose |
| --- | --- |
| `Raw_Executive_Projects` | Formula-owned raw import area for project data. |
| `Raw_Executive_Releases` | Formula-owned raw import area for release data. |
| `Automation_Export_Source` | Formula staging view with the exact export headers. |
| `Automation_Export` | Values-only last-known-good machine contract. |
| `Dashboard_Snapshots` | Append-only state snapshots from each successful poll. |
| `Dashboard_Changes` | Field-level old/new changes detected from observations. |
| `Dashboard_Observations` | Last successfully processed state per `Source Item ID`. |
| `Trigger_Log` | Communication trigger decisions and Hub draft creation attempts. |
| `Config` | Non-secret automation configuration. |

The older `Projects_Normalized`, `Gates_Normalized`, `Releases_Normalized`, and `Snapshots` tabs are deprecated and are no longer created by setup.

## Export Contract

`Automation_Export_Source` and `Automation_Export` share the same headers:

```text
Record Type, Source Item ID, Flow ID, Subject, Owner, Status, Phase, Risk Level,
Confidence, Primary Risk, Next Gate, Next Gate ETA, Release Date, Release Status,
Go / No-Go Required, Rollback Status, Impact, Included Projects, Known Issues,
Notes, Channel Override, Slack Thread ID, Manual Review, Updated At, Active
```

`Automation_Export_Source` may contain formulas. `Automation_Export` must be values-only and is written by Apps Script only after validation passes. The script reads the source using displayed values and formats automation-owned output sheets as plain text so date-like IDs such as `jan-26` are not converted into spreadsheet serial numbers.

Identity rules:

- `Record Type` is `Project` or `Release`.
- `Source Item ID` is required and stable.
- `Flow ID` is required and must start with `prj-` for projects or `rel-` for releases.
- `Active` rows are processed unless the value explicitly says false/no/0/inactive.
- `Manual Review` records history and evidence but skips Hub draft creation.

## Circuit Breaker

Before `Automation_Export` is overwritten, the script validates `Automation_Export_Source`:

- Header count and header names must exactly match the export contract.
- Active row count must be at least `MIN_ACTIVE_EXPORT_ROWS`.
- Headers and the first `EXPORT_ERROR_SCAN_ROWS` data rows are scanned for `#REF!`, `#N/A`, `#VALUE!`, `#NULL!`, and `#LOADING!`.
- Active rows must have valid `Record Type`, `Source Item ID`, and `Flow ID`.

If any check fails, the script preserves the previous `Automation_Export`, logs `Skipped - Circuit Breaker`, and stops.

## State Anchoring

Polling compares current export rows to `Dashboard_Observations`, not simply the previous poll.

For each active row:

1. The script writes a snapshot to `Dashboard_Snapshots`.
2. If the system has no observations yet, it records the first baseline and creates no drafts.
3. If a new row appears after baseline, it is evaluated like a new observed change.
4. If state changed, it writes field-level rows to `Dashboard_Changes`.
5. It evaluates whether the change should become a Hub draft.
6. It updates `Dashboard_Observations` only after the change is handled, explicitly skipped, or logged as no-communication-needed.

This prevents transient source-sheet issues from becoming false history.

## Trigger Decisions

V2 supports Projects and Releases.

Project changes can create `project.unexpected_status_change` when status, risk, confidence, phase, primary risk, next gate, or next gate ETA materially changes.

Release changes can create:

- `release.scheduled`
- `release.go_no_go`
- `release.started`
- `release.delayed`
- `release.rolled_back`
- `release.completed`

Hub draft creation is controlled by `CREATE_HUB_DRAFTS`. The default is `FALSE` for shadow polling.

## Retention

The script tracks `POLL_COUNT` and `LAST_GC_AT` in `Config`.

Every `GC_EVERY_N_POLLS` polls or weekly, it deletes active `Dashboard_Snapshots` and `Dashboard_Changes` rows older than `RETENTION_DAYS`.

Default retention is 60 days.

## Dev Reset

Use `resetAutomationShadowEvidenceForDev` to clear the v2 shadow polling outputs during setup:

- `Automation_Export`
- `Dashboard_Snapshots`
- `Dashboard_Changes`
- `Dashboard_Observations`
- `Trigger_Log`

The reset does not touch raw formula tabs or `Automation_Export_Source`. It also sets `CREATE_HUB_DRAFTS` back to `FALSE`.
