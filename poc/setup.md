# POC Setup

## 1. Create the Google Sheets

Create two spreadsheets:

1. `Stakeholder Communication Hub`
2. `Executive Dashboard`

In the Hub spreadsheet, create tabs:

- `Queue`
- `History`
- `Templates`
- `Config`

In the Executive Dashboard spreadsheet, create tab:

- `Projects`
- `Releases`

Use the CSV files in `schemas/` to create the headers and starter rows.

Relevant schema files:

- `hub-queue.csv`
- `hub-history.csv`
- `hub-templates.csv`
- `hub-config.csv`
- `dashboard-projects.csv`
- `dashboard-releases.csv`

## 2. Configure the Hub Apps Script

Open the Hub spreadsheet, then go to Extensions > Apps Script.

Create these files and paste the matching code:

- `hub/Code.gs`
- `hub/Config.gs`
- `hub/Queue.gs`
- `hub/Templates.gs`
- `hub/Slack.gs`
- `hub/Webhook.gs`

Script Properties required:

| Property | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot token beginning with `xoxb-`. |
| `DEFAULT_PROJECT_CHANNEL` | Slack channel ID for project updates. |
| `DEFAULT_INCIDENT_CHANNEL` | Slack channel ID for incident updates. |
| `DEFAULT_RELEASE_CHANNEL` | Slack channel ID for release updates. |
| `SLACK_VERIFICATION_TOKEN` | Optional Slack slash-command verification token. |
| `DASHBOARD_SPREADSHEET_ID` | Optional Executive Dashboard spreadsheet ID for weekly digest generation. |

Run `setupHubSheets()` once from Apps Script to create missing headers.

Optional: run `seedHubPocData()` once to insert starter template and config rows.

Create an installable trigger:

- Function: `onHubEdit`
- Event source: From spreadsheet
- Event type: On edit

Optional weekly digest trigger:

- Function: `buildWeeklyProjectDigestDraft`
- Event source: Time-driven
- Cadence: Weekly, before the leadership digest review window

Deploy the Hub script as a Web App:

- Execute as: Me
- Who has access: Anyone with the link, or internal domain if Slack can reach it

Use the Web App URL for both Slack slash commands.

For the POC, `SLACK_VERIFICATION_TOKEN` checks Slack's legacy slash-command token. Full Slack signing-secret verification is a later hardening step because Apps Script web apps do not expose request headers as cleanly as a normal server runtime.

## 3. Configure the Dashboard Apps Script

Open the Executive Dashboard spreadsheet, then go to Extensions > Apps Script.

Create these files and paste the matching code:

- `dashboard/Code.gs`
- `dashboard/Config.gs`

Script Properties required:

| Property | Purpose |
| --- | --- |
| `HUB_SPREADSHEET_ID` | Spreadsheet ID of the Stakeholder Communication Hub. |

Run `setupDashboardSheet()` once from Apps Script to create missing headers.

Create an installable trigger:

- Function: `onDashboardEdit`
- Event source: From spreadsheet
- Event type: On edit

## 4. Configure Slack

Create a Slack App with:

- Bot token scopes: `chat:write`, `commands`
- Slash commands: `/incident`, `/release`
- Request URL: Hub Web App URL

Install the app to the workspace and copy the bot token into Hub Script Properties.

## 5. Test the POC

### Incident Test

1. Run `/incident api outage affecting centers` in Slack.
2. Confirm a `Draft` row appears in Hub `Queue`.
3. Change `Status` to `Approved`.
4. Confirm Slack receives the message.
5. Confirm `Slack Thread ID`, `Sent At`, and `Slack Message URL` are populated.

### Project Test

1. Edit a project row in Executive Dashboard.
2. Change `Status` from `Green` to `Yellow` or `Red`.
3. Confirm a `Draft` row appears in Hub `Queue`.
4. Approve it.
5. Confirm Slack receives the project risk update.

### Manual Hub Test

1. Add a row directly to Hub `Queue`.
2. Fill `Lane`, `Communication Event`, `Project`, `Owner`, `Template Key`, `What`, `So What`, and `What's Next`.
3. Set `Status` to `Approved`.
4. Confirm Slack receives the message and the row is copied to `History`.

### Release Test

1. Add a release row in Executive Dashboard `Releases`.
2. Set `Planned Start` to a date/time.
3. Confirm a `Draft` row appears in Hub `Queue` for `Release scheduled`.
4. Approve it.
5. Confirm Slack receives the release update.
6. Change `Status` to `Started`, `Completed`, or `Delayed`, or set `Rollback Status` to `Full` / `Partial`.
7. Confirm the matching release draft is created.

### Weekly Digest Test

1. Add `DASHBOARD_SPREADSHEET_ID` to Hub Script Properties.
2. Run `buildWeeklyProjectDigestDraft()`.
3. Confirm a `Weekly project digest item` draft appears in Hub `Queue`.
4. Review and approve the draft.
