# Communication Automation POC

This POC turns the process repo into a working Google Sheets + Apps Script + Slack prototype.

## Architecture

| Component | Purpose |
| --- | --- |
| Stakeholder Communication Hub | Queue, templates, and outbound Slack sender. |
| Executive Dashboard | Project and release status source that creates draft communications when material changes happen. |
| Slack App | Slash command intake and bot-token message delivery. |

## Workflows

### Fast Path: Critical Incidents

```text
/incident in Slack
        |
        v
Hub web app receives payload
        |
        v
Draft row is created in Queue
        |
        v
Reviewer sets Status = Approved
        |
        v
Message posts to Slack
        |
        v
Slack Thread ID is stored for follow-up replies
```

### Slow Path: Projects

```text
TPM edits Executive Dashboard
        |
        v
Dashboard monitor detects material status change
        |
        v
Draft row is created in Hub Queue
        |
        v
Reviewer sets Status = Approved
        |
        v
Message posts to Slack
```

### Release Path

```text
Release row changes in Executive Dashboard
        |
        v
Release event is detected
        |
        v
Draft row is created in Hub Queue
        |
        v
Reviewer approves
        |
        v
Message posts to release Slack channel
```

## Files

- `schemas/`: CSV headers and starter template rows for the Google Sheets tabs.
- `google-apps-script/hub/`: Apps Script files for the Stakeholder Communication Hub.
- `google-apps-script/dashboard/`: Apps Script files for the Executive Dashboard monitor.
- `setup.md`: Step-by-step setup guide.
