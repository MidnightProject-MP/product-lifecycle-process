# Change Versions

Change versions describe the specific old-state to new-state transition that fires a communication trigger.

Triggers name the communication event. Change versions make the event automation-ready.

```text
Old state + New state = Change version = Trigger
```

## Production Release Change Versions

| Trigger | Change Version | Old State | New State |
| --- | --- | --- | --- |
| Release scheduled | New schedule | No scheduled release date/time. | Release date/time is set. |
| Release scheduled | Schedule changed | Existing release date/time. | New release date/time is set before release begins. |
| Go / no-go approaching | Gate window opened | Go / no-go was not yet inside lead time. | Go / no-go is inside defined lead time. |
| Go / no-go approaching | Readiness decision required | No active decision required. | Release requires go, no-go, or conditional-go decision. |
| Release started | Execution started | Release not started. | Release execution begins. |
| Release completed | Execution completed | Release in progress. | Release completed successfully. |
| Release delayed | Schedule missed | Planned release time reached without execution starting. | Release is delayed and needs new ETA. |
| Release delayed | Delay declared | Release scheduled or in progress. | Release owner declares delay. |
| Release rolled back | Full rollback | Release completed or in progress. | Release is fully rolled back. |
| Release rolled back | Partial rollback | Release completed or in progress. | Part of the release is rolled back. |
| Postmortem needed | Postmortem required | No postmortem required. | Postmortem is required due to rollback, critical bug, failed gate, or material issue. |

## Change Version Rule

Each communication matrix trigger should eventually have one or more change versions.

Automation should log:

- Trigger.
- Change version.
- Old state.
- New state.
- Source field or event.
- Timestamp.
- Owner.

