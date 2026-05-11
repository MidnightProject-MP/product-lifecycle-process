function setupHubSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
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
      Text: '*Critical Bug Identified*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'project-unexpected-status-change',
      Lane: 'Project',
      'Communication Event': 'Unexpected status change',
      'Lifecycle Stage': 'Execution',
      Scenario: 'Project Risk',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      Text: '*Project Status Change*: {{Project}}\n*Stage*: {{Lifecycle Stage}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}\n*Owner*: {{Owner}}'
    },
    {
      'Template Key': 'release-execution',
      Lane: 'Production Release',
      'Communication Event': 'Release started',
      'Lifecycle Stage': 'Release',
      Scenario: 'Release Execution',
      'Default Channel Type': 'Release',
      'Post Mode': 'New Thread',
      Text: '*Release Update*: {{Project}}\n*What*: {{What}}\n*So What*: {{So What}}\n*What\'s Next*: {{What\'s Next}}'
    },
    {
      'Template Key': 'stray-story-disposition',
      Lane: 'Stray Story',
      'Communication Event': 'Disposition changed',
      'Lifecycle Stage': 'Prioritization',
      Scenario: 'Stray Story',
      'Default Channel Type': 'Project',
      'Post Mode': 'New Thread',
      Text: '*Stray Story Update*: {{Project}}\n*Disposition*: {{Destination}}\n*Reason*: {{Reason}}\n*What\'s Next*: {{What\'s Next}}'
    }
  ]);

  seedRows_(config, 'Key', [
    { Key: 'DEFAULT_PROJECT_CHANNEL', Value: '' },
    { Key: 'DEFAULT_INCIDENT_CHANNEL', Value: '' },
    { Key: 'DEFAULT_RELEASE_CHANNEL', Value: '' }
  ]);
}

function onHubEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== HUB.SHEETS.QUEUE) return;

  const row = e.range.getRow();
  if (row === 1) return;

  const headers = getHeaders_(sheet);
  const editedHeader = headers[e.range.getColumn() - 1];
  if (editedHeader !== 'Status') return;

  const status = String(e.value || '').trim();
  if (status !== HUB.STATUS.APPROVED) return;

  sendApprovedQueueRow_(sheet, row);
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const isEmpty = current.every(value => value === '');
  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function seedRows_(sheet, keyField, rows) {
  const headers = getHeaders_(sheet);
  const existing = getObjects_(sheet).map(row => String(row[keyField]));
  rows.forEach(row => {
    if (existing.indexOf(String(row[keyField])) >= 0) return;
    sheet.appendRow(headers.map(header => row[header] || ''));
  });
}
