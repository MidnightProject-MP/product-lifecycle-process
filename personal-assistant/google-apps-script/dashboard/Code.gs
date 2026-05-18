function setupDashboardMonitor() {
  const sourceId = getDashboardSourceSpreadsheetId_();
  if (!sourceId) throw new Error('Missing LEADERSHIP_SPREADSHEET_ID or EXECUTIVE_DASHBOARD_SPREADSHEET_ID script property.');

  const source = SpreadsheetApp.openById(sourceId);
  validateDashboardSourceSheet_(source, DASHBOARD.SHEETS.PROJECTS, DASHBOARD.PROJECT_HEADERS);
  validateDashboardSourceSheet_(source, DASHBOARD.SHEETS.RELEASES, DASHBOARD.RELEASE_HEADERS);
  recreateDashboardEditTrigger_(sourceId);
}

function setupDashboardSheet() {
  setupDashboardMonitor();
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
    insertHubDraftAtTop_(draft);
  }

  if (shouldWriteBackToDashboardSource_()) {
    updateDashboardRowFields_(sheet, row, {
      'Last Communication Triggered At': dashboardNowIso_()
    });
  }
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
  insertHubDraftAtTop_({
    Source: 'Executive Dashboard',
    Lane: 'Project',
    'Event Key': 'project.unexpected_status_change',
    Status: 'Draft',
    Priority: String(project.Status) === 'Red' ? 'High' : 'Medium',
    Owner: project.Owner || project['Lead PM'],
    'Flow ID': 'project-' + normalizeDashboardKey_(project.Project),
    'Dedupe Key': 'project|' + project.Project + '|' + field + '|' + newValue,
    'Payload JSON': JSON.stringify({
      project: project.Project,
      owner: project.Owner || project['Lead PM'],
      lifecycle_stage: project['Current Phase'],
      status: project.Status,
      primary_risk: project['Primary Risk'],
      next_gate: project['Next Major Gate'],
      next_gate_eta: project['Next Gate ETA'],
      what: field + ' changed from "' + oldValue + '" to "' + newValue + '".',
      so_what: 'This may affect project expectations, risk, timeline, release, or stakeholder confidence.',
      whats_next: 'Lead PM or TPM should review the change, confirm impact, and approve or discard this draft.'
    })
  });
}

function buildReleaseDraft_(release, field, oldValue, newValue) {
  if (String(oldValue) === String(newValue)) return null;

  const status = String(release.Status || newValue || '').toLowerCase();
  let eventKey = '';
  let priority = 'Medium';

  if (field === 'Planned Start' && newValue) {
    eventKey = 'release.scheduled';
  } else if (field === 'Go / No-Go Required' && String(newValue).toLowerCase() === 'yes') {
    eventKey = 'release.go_no_go';
    priority = 'High';
  } else if (field === 'Status' && status === 'started') {
    eventKey = 'release.started';
  } else if (field === 'Status' && status === 'completed') {
    eventKey = 'release.completed';
  } else if (field === 'Status' && status === 'delayed') {
    eventKey = 'release.delayed';
    priority = 'High';
  } else if (field === 'Rollback Status' && String(newValue).toLowerCase() !== 'none' && newValue) {
    eventKey = 'release.rolled_back';
    priority = 'Critical';
  } else {
    return null;
  }

  return {
    Source: 'Executive Dashboard',
    Lane: 'Production Release',
    'Event Key': eventKey,
    Status: 'Draft',
    Priority: priority,
    Owner: release['Release Owner'],
    Approver: release['Decision Owner'],
    'Channel Override': release['Primary Channel'],
    'Slack Thread ID': release['Slack Thread ID'],
    'Flow ID': 'release-' + normalizeDashboardKey_(release['Release ID'] || release['Release Name']),
    'Dedupe Key': 'release|' + (release['Release ID'] || release['Release Name']) + '|' + eventKey + '|' + newValue,
    'Payload JSON': JSON.stringify({
      release_id: release['Release ID'],
      release_name: release['Release Name'] || release['Release ID'],
      project: release['Release Name'] || release['Release ID'],
      owner: release['Release Owner'],
      decision_owner: release['Decision Owner'],
      planned_start: release['Planned Start'],
      included_projects: release['Included Projects'],
      included_bugs: release['Included Bugs'],
      included_stray_stories: release['Included Stray Stories'],
      known_issues: release['Known Issues'],
      what: field + ' changed from "' + oldValue + '" to "' + newValue + '". Included projects: ' + (release['Included Projects'] || 'TBD') + '.',
      so_what: 'This release update may affect production timing, support readiness, monitoring, or stakeholder expectations.',
      whats_next: 'Release Owner should review readiness, confirm impact, and approve or discard this draft.'
    })
  };
}

function insertHubDraftAtTop_(draft) {
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

  const duplicateQueueId = findHubActiveQueueIdByDedupeKey_(queue, item['Dedupe Key']);
  if (duplicateQueueId) return duplicateQueueId;

  insertDashboardValuesAtTop_(queue, headers.map(header => item[header] || ''));
  return item['Queue ID'];
}

function normalizeDashboardKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateDashboardSourceSheet_(ss, name, expectedHeaders) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Dashboard source sheet is missing: ' + name);

  const headers = getDashboardHeaders_(sheet);
  const missing = expectedHeaders.filter(header => headers.indexOf(header) < 0 && header !== 'Last Communication Triggered At');
  if (missing.length) {
    throw new Error('Dashboard source sheet "' + name + '" is missing headers: ' + missing.join(', '));
  }
  return sheet;
}

function recreateDashboardEditTrigger_(sourceId) {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onDashboardEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onDashboardEdit')
    .forSpreadsheet(sourceId)
    .onEdit()
    .create();
}

function shouldWriteBackToDashboardSource_() {
  return String(getDashboardScriptProperty_('WRITE_BACK_TO_SOURCE') || '').toUpperCase() === 'TRUE';
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

function findHubActiveQueueIdByDedupeKey_(queue, dedupeKey) {
  if (!dedupeKey) return '';
  const rows = getDashboardObjects_(queue);
  const active = rows.find(row =>
    row['Dedupe Key'] === dedupeKey &&
    ['Draft', 'Approved', 'Scheduled'].indexOf(row.Status) >= 0
  );
  return active ? active['Queue ID'] : '';
}

function getDashboardObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });
}

function insertDashboardValuesAtTop_(sheet, values) {
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, values.length).setValues([values]);
}
