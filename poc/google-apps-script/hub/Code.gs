function setupHubSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  ensureSheet_(ss, HUB.SHEETS.HISTORY, HUB.HEADERS.HISTORY);
  ensureSheet_(ss, HUB.SHEETS.RUN_LOG, HUB.HEADERS.RUN_LOG);
  ensureSheet_(ss, HUB.SHEETS.TEMPLATES, HUB.HEADERS.TEMPLATES);
  ensureSheet_(ss, HUB.SHEETS.CONFIG, HUB.HEADERS.CONFIG);
}

function seedHubPocData() {
  setupHubSheets();

  const ss = SpreadsheetApp.getActive();
  const templates = ss.getSheetByName(HUB.SHEETS.TEMPLATES);
  const config = ss.getSheetByName(HUB.SHEETS.CONFIG);

  seedRows_(templates, 'Template Key', [
    {
      'Template Key': 'critical-bug-identified',
      Lane: 'Incident / Bug',
      'Communication Event': 'Critical bug identified',
      'Lifecycle Stage': 'Investigating',
      Scenario: 'Critical Bug',
      'Default Channel Type': 'Incident',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Approval required',
      Text: '*Critical Bug Identified*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'critical-bug-investigating',
      Lane: 'Incident / Bug',
      'Communication Event': 'Investigating',
      'Lifecycle Stage': 'Investigating',
      Scenario: 'Critical Bug',
      'Default Channel Type': 'Incident',
      'Post Mode': 'Reply In Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Critical Bug Update*: {{Project}}\n*Stage*: {{Lifecycle Stage}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'critical-bug-fix-in-progress',
      Lane: 'Incident / Bug',
      'Communication Event': 'Fix in progress',
      'Lifecycle Stage': 'Fix in progress',
      Scenario: 'Critical Bug',
      'Default Channel Type': 'Incident',
      'Post Mode': 'Reply In Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Critical Bug Update*: {{Project}}\n*Stage*: Fix in Progress\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'critical-bug-fix-in-qa',
      Lane: 'Incident / Bug',
      'Communication Event': 'Fix in QA',
      'Lifecycle Stage': 'Fix in QA',
      Scenario: 'Critical Bug',
      'Default Channel Type': 'Incident',
      'Post Mode': 'Reply In Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Critical Bug Update*: {{Project}}\n*Stage*: Fix in QA\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'critical-bug-ready-for-release',
      Lane: 'Incident / Bug',
      'Communication Event': 'Fix ready for release',
      'Lifecycle Stage': 'Fix ready for release',
      Scenario: 'Critical Bug',
      'Default Channel Type': 'Incident',
      'Post Mode': 'Reply In Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Critical Bug Update*: {{Project}}\n*Stage*: Fix Ready for Release\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'critical-bug-sad-path',
      Lane: 'Incident / Bug',
      'Communication Event': 'Critical bug delayed',
      'Lifecycle Stage': 'Delayed',
      Scenario: 'Critical Bug',
      'Default Channel Type': 'Incident',
      'Post Mode': 'Reply In Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Critical Bug Exception*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'project-kickoff',
      Lane: 'Project',
      'Communication Event': 'Project kickoff',
      'Lifecycle Stage': 'Discovery',
      Scenario: 'Project Kickoff',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Project Kickoff*: {{Project}}\n*Stage*: {{Lifecycle Stage}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'project-unexpected-status-change',
      Lane: 'Project',
      'Communication Event': 'Unexpected status change',
      'Lifecycle Stage': 'Execution',
      Scenario: 'Project Risk',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Project Status Change*: {{Project}}\n*Stage*: {{Lifecycle Stage}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'project-weekly-digest',
      Lane: 'Project',
      'Communication Event': 'Weekly project digest item',
      'Lifecycle Stage': 'All',
      Scenario: 'Weekly Digest',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Weekly Project Digest*\n{{What}}\n\n*So What*\n{{So What}}\n\n*What\'s Next*\n{{What\'s Next}}'
    },
    {
      'Template Key': 'project-gate',
      Lane: 'Project',
      'Communication Event': 'Gate approaching',
      'Lifecycle Stage': 'Planning',
      Scenario: 'Gate',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Project Gate Update*: {{Project}}\n*Gate*: {{Destination}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}'
    },
    {
      'Template Key': 'release-execution',
      Lane: 'Production Release',
      'Communication Event': 'Release started',
      'Lifecycle Stage': 'Release',
      Scenario: 'Release Execution',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Auto-send eligible',
      Text: '*Release Update*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}'
    },
    {
      'Template Key': 'release-completed',
      Lane: 'Production Release',
      'Communication Event': 'Release completed',
      'Lifecycle Stage': 'Release',
      Scenario: 'Release Execution',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Release Completed*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}'
    },
    {
      'Template Key': 'release-go-no-go',
      Lane: 'Production Release',
      'Communication Event': 'Go / no-go approaching',
      'Lifecycle Stage': 'Release',
      Scenario: 'Go / No-Go',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Approval required',
      Text: '*Release Go / No-Go*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Decision Owner*: {{Approver}}'
    },
    {
      'Template Key': 'release-scheduled',
      Lane: 'Production Release',
      'Communication Event': 'Release scheduled',
      'Lifecycle Stage': 'Release',
      Scenario: 'Release Scheduled',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Review then send',
      Text: '*Release Scheduled*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'release-delayed',
      Lane: 'Production Release',
      'Communication Event': 'Release delayed',
      'Lifecycle Stage': 'Release',
      Scenario: 'Release Delay',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Approval required',
      Text: '*Release Delayed*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'release-rolled-back',
      Lane: 'Production Release',
      'Communication Event': 'Release rolled back',
      'Lifecycle Stage': 'Release',
      Scenario: 'Release Rollback',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Approval required',
      Text: '*Release Rolled Back*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'stray-story-disposition',
      Lane: 'Stray Story',
      'Communication Event': 'Disposition changed',
      'Lifecycle Stage': 'Prioritization',
      Scenario: 'Stray Story',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      'Default Send Rule': 'Auto-send eligible',
      Text: '*Stray Story Update*: {{Project}}\n*Disposition*: {{Destination}}\n*Reason*: {{Reason}}\n*What\'s Next*: {{What\'s Next}}'
    }
  ]);

  seedRows_(config, 'Key', [
    { Key: 'DEFAULT_PROJECT_CHANNEL', Value: '' },
    { Key: 'DEFAULT_INCIDENT_CHANNEL', Value: '' },
    { Key: 'DEFAULT_RELEASE_CHANNEL', Value: '' },
    { Key: 'SLACK_VERIFICATION_TOKEN', Value: '' },
    { Key: 'DASHBOARD_SPREADSHEET_ID', Value: '' }
  ]);
}

function onHubEdit(e) {
  if (!e || !e.range) {
    logHub_('WARN', 'onHubEdit', '', 'Skipped because event/range was missing.', {});
    return;
  }

  const sheet = e.range.getSheet();
  if (sheet.getName() !== HUB.SHEETS.QUEUE) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped edit outside Queue.', { sheet: sheet.getName() });
    return;
  }

  const row = e.range.getRow();
  if (row === 1) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped header row edit.', {});
    return;
  }

  const headers = getHeaders_(sheet);
  const editedHeader = headers[e.range.getColumn() - 1];
  if (editedHeader !== 'Status') {
    logHub_('INFO', 'onHubEdit', '', 'Skipped non-status edit.', { editedHeader: editedHeader, row: row });
    return;
  }

  const status = String(e.value || '').trim();
  const item = getRowObject_(sheet, row);
  const queueId = item['Queue ID'] || '';
  logHub_('INFO', 'onHubEdit', queueId, 'Status edit detected.', { row: row, status: status });

  if (status !== HUB.STATUS.APPROVED) {
    logHub_('INFO', 'onHubEdit', queueId, 'Skipped because status is not Approved.', { status: status });
    return;
  }

  sendApprovedQueueRow_(sheet, row);
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  enforceHeaders_(sheet, headers);
  return sheet;
}

function enforceHeaders_(sheet, headers) {
  const currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0];
  const existing = current.filter(value => value !== '');
  const merged = headers.slice();

  existing.forEach(header => {
    if (merged.indexOf(header) < 0) merged.push(header);
  });

  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function logHub_(level, fn, queueId, message, details) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ensureSheet_(ss, HUB.SHEETS.RUN_LOG, HUB.HEADERS.RUN_LOG);
    sheet.appendRow([
      uuid_(),
      nowIso_(),
      level,
      fn,
      queueId || '',
      message,
      details ? JSON.stringify(details) : ''
    ]);
  } catch (error) {
    console.log(level + ' ' + fn + ' ' + message + ' ' + JSON.stringify(details || {}) + ' log_error=' + error);
  }
}

function seedRows_(sheet, keyField, rows) {
  const headers = getHeaders_(sheet);
  const existing = getObjects_(sheet).map(row => String(row[keyField]));
  rows.forEach(row => {
    if (existing.indexOf(String(row[keyField])) >= 0) return;
    sheet.appendRow(headers.map(header => row[header] || ''));
  });
}
