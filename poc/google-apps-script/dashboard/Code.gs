function setupDashboardSheet() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(DASHBOARD.SHEET_NAME) || ss.insertSheet(DASHBOARD.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DASHBOARD.HEADERS);
  }
}

function onDashboardEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== DASHBOARD.SHEET_NAME) return;

  const row = e.range.getRow();
  if (row === 1) return;

  const headers = getDashboardHeaders_(sheet);
  const editedHeader = headers[e.range.getColumn() - 1];
  if (DASHBOARD.WATCHED_FIELDS.indexOf(editedHeader) < 0) return;

  const oldValue = e.oldValue || '';
  const newValue = e.value || '';
  if (!shouldCreateProjectDraft_(editedHeader, oldValue, newValue)) return;

  const project = getDashboardRowObject_(sheet, row);
  createHubDraftFromDashboard_(project, editedHeader, oldValue, newValue);
  updateDashboardRowFields_(sheet, row, {
    'Last Communication Triggered At': dashboardNowIso_()
  });
}

function shouldCreateProjectDraft_(field, oldValue, newValue) {
  if (String(oldValue) === String(newValue)) return false;

  if (field === 'Status') {
    return ['Yellow', 'Red'].indexOf(String(newValue)) >= 0;
  }

  if (field === 'IT Risk Level') {
    return ['High', 'Critical'].indexOf(String(newValue)) >= 0;
  }

  if (field === 'Confidence of Owner (1-10)') {
    const oldScore = Number(oldValue);
    const newScore = Number(newValue);
    return newScore > 0 && (newScore <= 5 || oldScore - newScore >= 2);
  }

  return ['Current Phase', 'Primary Risk', 'Next Major Gate', 'Next Gate ETA', 'User Exposure'].indexOf(field) >= 0;
}

function createHubDraftFromDashboard_(project, field, oldValue, newValue) {
  const hubId = getDashboardScriptProperty_('HUB_SPREADSHEET_ID');
  if (!hubId) throw new Error('Missing HUB_SPREADSHEET_ID script property.');

  const hub = SpreadsheetApp.openById(hubId);
  const queue = hub.getSheetByName('Queue');
  if (!queue) throw new Error('Hub Queue sheet is missing.');

  const headers = getDashboardHeaders_(queue);
  const item = {
    'Queue ID': Utilities.getUuid(),
    'Created At': dashboardNowIso_(),
    'Updated At': dashboardNowIso_(),
    Source: 'Executive Dashboard',
    Lane: 'Project',
    'Communication Event': 'Unexpected status change',
    'Lifecycle Stage': project['Current Phase'],
    Scenario: 'Project Risk',
    Status: 'Draft',
    Priority: String(project.Status) === 'Red' ? 'High' : 'Medium',
    Project: project.Project,
    Owner: project.Owner || project['Lead PM'],
    'Template Key': 'project-unexpected-status-change',
    What: field + ' changed from "' + oldValue + '" to "' + newValue + '".',
    'So What': 'This may affect project expectations, risk, timeline, release, or stakeholder confidence.',
    "What's Next": 'Lead PM or TPM should review the change, confirm impact, and approve or discard this draft.'
  };

  queue.appendRow(headers.map(header => item[header] || ''));
}

function getDashboardHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getDashboardRowObject_(sheet, row) {
  const headers = getDashboardHeaders_(sheet);
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  return headers.reduce((obj, header, index) => {
    obj[header] = values[index];
    return obj;
  }, {});
}

function updateDashboardRowFields_(sheet, row, fields) {
  const headers = getDashboardHeaders_(sheet);
  Object.keys(fields).forEach(key => {
    const col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(row, col).setValue(fields[key]);
  });
}

