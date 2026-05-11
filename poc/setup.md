# POC Setup

## 1. Create the Google Sheets

Create two spreadsheets:

1. `Stakeholder Communication Hub`
2. `Executive Dashboard`

In the Hub spreadsheet, create tabs:

- `Queue`
- `Templates`
- `Config`

In the Executive Dashboard spreadsheet, create tab:

- `Projects`

Use the CSV files in `schemas/` to create the headers and starter rows.

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

Run `setupHubSheets()` once from Apps Script to create missing headers.

Optional: run `seedHubPocData()` once to insert starter template and config rows.

Create an installable trigger:

- Function: `onHubEdit`
- Event source: From spreadsheet
- Event type: On edit

Deploy the Hub script as a Web App:

- Execute as: Me
- Who has access: Anyone with the link, or internal domain if Slack can reach it

Use the Web App URL for the Slack slash command.

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
- Slash command: `/incident`
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
