function setupDashboardSheet() {
  const ss = SpreadsheetApp.getActive();
  ensureDashboardSheet_(ss, DASHBOARD.SHEETS.PROJECTS, DASHBOARD.PROJECT_HEADERS);
  ensureDashboardSheet_(ss, DASHBOARD.SHEETS.RELEASES, DASHBOARD.RELEASE_HEADERS);
}

function onDashboardEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if ([DASHBOARD.SHEETS.PROJECTS, DASHBOARD.SHEETS.RELEASES].indexOf(sheet.getName()) < 0) return;

  const row = e.range.getRow();
  if (row === 1) return;

  const headers = getDashboardHeaders_(sheet);
  const editedHeader = headers[e.range.getColumn() - 1];
  const oldValue = e.oldValue || '';
  const newValue = e.value || '';

  if (sheet.getName() === DASHBOARD.SHEETS.PROJECTS) {
    if (DASHBOARD.PROJECT_WATCHED_FIELDS.indexOf(editedHeader) < 0) return;
    if (!shouldCreateProjectDraft_(editedHeader, oldValue, newValue)) return;
    const project = getDashboardRowObject_(sheet, row);
    createProjectDraftFromDashboard_(project, editedHeader, oldValue, newValue);
  }

  if (sheet.getName() === DASHBOARD.SHEETS.RELEASES) {
    if (DASHBOARD.RELEASE_WATCHED_FIELDS.indexOf(editedHeader) < 0) return;
    const release = getDashboardRowObject_(sheet, row);
    const draft = buildReleaseDraft_(release, editedHeader, oldValue, newValue);
    if (!draft) return;
    appendHubDraft_(draft);
  }

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

function createProjectDraftFromDashboard_(project, field, oldValue, newValue) {
  appendHubDraft_({
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
  });
}

function buildReleaseDraft_(release, field, oldValue, newValue) {
  if (String(oldValue) === String(newValue)) return null;

  const status = String(release.Status || newValue || '').toLowerCase();
  let event = '';
  let templateKey = '';
  let scenario = '';
  let priority = 'Medium';

  if (field === 'Planned Start' && newValue) {
    event = 'Release scheduled';
    templateKey = 'release-scheduled';
    scenario = 'Release Scheduled';
  } else if (field === 'Go / No-Go Required' && String(newValue).toLowerCase() === 'yes') {
    event = 'Go / no-go approaching';
    templateKey = 'release-scheduled';
    scenario = 'Go / No-Go';
    priority = 'High';
  } else if (field === 'Status' && status === 'started') {
    event = 'Release started';
    templateKey = 'release-execution';
    scenario = 'Release Execution';
  } else if (field === 'Status' && status === 'completed') {
    event = 'Release completed';
    templateKey = 'release-execution';
    scenario = 'Release Execution';
  } else if (field === 'Status' && status === 'delayed') {
    event = 'Release delayed';
    templateKey = 'release-delayed';
    scenario = 'Release Delay';
    priority = 'High';
  } else if (field === 'Rollback Status' && String(newValue).toLowerCase() !== 'none' && newValue) {
    event = 'Release rolled back';
    templateKey = 'release-rolled-back';
    scenario = 'Release Rollback';
    priority = 'Critical';
  } else {
    return null;
  }

  return {
    Source: 'Executive Dashboard',
    Lane: 'Production Release',
    'Communication Event': event,
    'Lifecycle Stage': 'Release',
    Scenario: scenario,
    Status: 'Draft',
    Priority: priority,
    Project: release['Release Name'] || release['Release ID'],
    Owner: release['Release Owner'],
    Channel: release['Primary Channel'],
    'Slack Thread ID': release['Slack Thread ID'],
    'Template Key': templateKey,
    What: field + ' changed from "' + oldValue + '" to "' + newValue + '". Included projects: ' + (release['Included Projects'] || 'TBD') + '.',
    'So What': 'This release update may affect production timing, support readiness, monitoring, or stakeholder expectations.',
    "What's Next": 'Release Owner should review readiness, confirm impact, and approve or discard this draft.'
  };
}

function appendHubDraft_(draft) {
  const hubId = getDashboardScriptProperty_('HUB_SPREADSHEET_ID');
  if (!hubId) throw new Error('Missing HUB_SPREADSHEET_ID script property.');

  const hub = SpreadsheetApp.openById(hubId);
  const queue = hub.getSheetByName('Queue');
  if (!queue) throw new Error('Hub Queue sheet is missing.');

  const headers = getDashboardHeaders_(queue);
  const item = Object.assign({
    'Queue ID': Utilities.getUuid(),
    'Created At': dashboardNowIso_(),
    'Updated At': dashboardNowIso_()
  }, draft);

  queue.appendRow(headers.map(header => item[header] || ''));
}

function ensureDashboardSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
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
