function setupAutomationSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.PROJECTS, AUTOMATION.HEADERS.PROJECTS);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.GATES, AUTOMATION.HEADERS.GATES);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.RELEASES, AUTOMATION.HEADERS.RELEASES);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.SNAPSHOTS, AUTOMATION.HEADERS.SNAPSHOTS);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.TRIGGER_LOG, AUTOMATION.HEADERS.TRIGGER_LOG);
  const config = ensureAutomationSheet_(ss, AUTOMATION.SHEETS.CONFIG, AUTOMATION.HEADERS.CONFIG);
  seedAutomationConfig_(config);
}

function ensureAutomationSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  enforceAutomationHeaders_(sheet, headers);
  return sheet;
}

function enforceAutomationHeaders_(sheet, headers) {
  const currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0];
  const existing = current.filter(value => value !== '');
  const merged = headers.slice();

  existing.forEach(header => {
    if (merged.indexOf(header) < 0) merged.push(header);
  });

  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
}

function seedAutomationConfig_(sheet) {
  const values = sheet.getDataRange().getValues();
  const existingKeys = values.slice(1).map(row => String(row[0]));

  AUTOMATION.CONFIG_ROWS.forEach(row => {
    if (existingKeys.indexOf(row[0]) >= 0) return;
    sheet.appendRow(row);
  });
}

function syncLeadershipDashboardToAutomation() {
  setupAutomationSheets();

  const config = getAutomationConfig_();
  const leadershipId = config.LEADERSHIP_SPREADSHEET_ID;
  if (!leadershipId) throw new Error('Missing LEADERSHIP_SPREADSHEET_ID in Automation Config.');

  const leadership = SpreadsheetApp.openById(leadershipId);
  const automation = SpreadsheetApp.getActive();

  const projects = normalizeProjects_(leadership, config);
  const gates = normalizeGates_(leadership, config);
  const releases = normalizeReleases_(leadership, config);

  writeNormalizedRows_(automation.getSheetByName(AUTOMATION.SHEETS.PROJECTS), AUTOMATION.HEADERS.PROJECTS, projects);
  writeNormalizedRows_(automation.getSheetByName(AUTOMATION.SHEETS.GATES), AUTOMATION.HEADERS.GATES, gates);
  writeNormalizedRows_(automation.getSheetByName(AUTOMATION.SHEETS.RELEASES), AUTOMATION.HEADERS.RELEASES, releases);

  projects.concat(gates).concat(releases).forEach(row => recordSnapshotAndTrigger_(automation, row));
}

function normalizeProjects_(leadership, config) {
  const sheet = leadership.getSheetByName(config.PROJECTS_SOURCE_SHEET);
  if (!sheet) throw new Error('Project source sheet not found: ' + config.PROJECTS_SOURCE_SHEET);

  const rows = readRows_(sheet, Number(config.PROJECTS_START_ROW), Number(config.PROJECTS_END_ROW));
  return rows
    .filter(row => row[0])
    .map((row, index) => {
      const sourceRow = Number(config.PROJECTS_START_ROW) + index;
      const project = String(row[0] || '').trim();
      const status = String(row[6] || '').trim();
      const normalized = {
        'Work Item Type': 'Project',
        'Source Spreadsheet ID': leadership.getId(),
        'Source Sheet': config.PROJECTS_SOURCE_SHEET,
        'Source Row': sourceRow,
        'Source Row Key': 'project|' + project,
        'Flow ID': 'project-' + normalizeAutomationKey_(project),
        Project: project,
        'Lead PM': row[1] || '',
        Owner: row[2] || '',
        'Current Phase': row[3] || '',
        'Normalized Phase': normalizePhase_(row[3]),
        'User Exposure': row[4] || '',
        'Progress %': row[5] || '',
        Status: status,
        'Normalized Status': normalizeStatus_(status),
        'Confidence of Owner (1-10)': row[7] || '',
        'IT Risk Level': row[8] || '',
        'Primary Risk': row[9] || '',
        'Next Major Gate': row[10] || '',
        'Next Gate ETA': row[11] || '',
        'Primary Target': row[12] || '',
        'Release Date': '',
        'Release Status': '',
        'Last Seen At': automationNowIso_(),
        'Processing Status': 'Normalized'
      };
      return finalizeNormalizedRow_(normalized, 'Project');
    });
}

function normalizeGates_(leadership, config) {
  const sheet = leadership.getSheetByName(config.GATES_SOURCE_SHEET);
  if (!sheet) throw new Error('Gate source sheet not found: ' + config.GATES_SOURCE_SHEET);

  const rows = readRows_(sheet, Number(config.GATES_START_ROW), Number(config.GATES_END_ROW));
  const leadDays = Number(config.GATE_APPROACHING_DAYS || 14);
  return rows
    .filter(row => row[0] || row[1] || row[2])
    .map((row, index) => {
      const sourceRow = Number(config.GATES_START_ROW) + index;
      const project = String(row[0] || '').trim();
      const gate = String(row[1] || row[2] || '').trim();
      const targetDate = row[2] || '';
      const actualDate = row[3] || '';
      const status = String(row[4] || '').trim();
      const daysUntil = daysUntil_(targetDate);
      const normalized = {
        'Work Item Type': 'Gate',
        'Source Spreadsheet ID': leadership.getId(),
        'Source Sheet': config.GATES_SOURCE_SHEET,
        'Source Row': sourceRow,
        'Source Row Key': 'gate|' + project + '|' + gate,
        'Flow ID': 'project-' + normalizeAutomationKey_(project),
        Project: project,
        Gate: gate,
        'Target Date': targetDate,
        'Actual Date': actualDate,
        'Gate Status': status,
        'Normalized Gate Status': normalizeGateStatus_(status),
        'Previous Gate Status': '',
        'Days Until Target': daysUntil,
        'Is Gate Approaching': daysUntil !== '' && daysUntil >= 0 && daysUntil <= leadDays ? 'TRUE' : 'FALSE',
        'Is Gate Missed': daysUntil !== '' && daysUntil < 0 && !actualDate ? 'TRUE' : 'FALSE',
        'Last Seen At': automationNowIso_(),
        'Processing Status': 'Normalized'
      };
      return finalizeNormalizedRow_(normalized, 'Gate');
    });
}

function normalizeReleases_(leadership, config) {
  const sheet = leadership.getSheetByName(config.RELEASES_SOURCE_SHEET);
  if (!sheet) throw new Error('Release source sheet not found: ' + config.RELEASES_SOURCE_SHEET);

  const rows = readRows_(sheet, Number(config.RELEASES_START_ROW), Number(config.RELEASES_END_ROW));
  return rows
    .filter(row => row[0] || row[1] || row[2])
    .map((row, index) => {
      const sourceRow = Number(config.RELEASES_START_ROW) + index;
      const releaseDate = row[0] || '';
      const project = String(row[1] || '').trim();
      const type = String(row[2] || '').trim();
      const phase = String(row[3] || '').trim();
      const impact = String(row[4] || '').trim();
      const notes = String(row[5] || '').trim();
      const releaseId = 'rel-' + normalizeAutomationKey_(project + '-' + releaseDate + '-' + type);
      const normalized = {
        'Work Item Type': 'Production Release',
        'Source Spreadsheet ID': leadership.getId(),
        'Source Sheet': config.RELEASES_SOURCE_SHEET,
        'Source Row': sourceRow,
        'Source Row Key': 'release|' + releaseId,
        'Flow ID': 'release-' + normalizeAutomationKey_(releaseId),
        'Release ID': releaseId,
        Project: project,
        'Release Date': releaseDate,
        Type: type,
        Phase: phase,
        'Impact Level': impact,
        Notes: notes,
        'Normalized Release Status': normalizeReleaseStatus_(phase),
        'Release Event': inferReleaseEvent_(phase, notes),
        'Included Projects': project,
        'Included Bugs': '',
        'Included Stray Stories': '',
        'Known Issues': '',
        'Go / No-Go Required': /go|no-go|readiness/i.test(notes) ? 'Yes' : '',
        'Decision Owner': '',
        'Primary Channel': '',
        'Slack Thread ID': '',
        'Last Seen At': automationNowIso_(),
        'Processing Status': 'Normalized'
      };
      return finalizeNormalizedRow_(normalized, 'Production Release');
    });
}

function finalizeNormalizedRow_(row, workItemType) {
  const stateJson = JSON.stringify(row);
  const hash = hashString_(stateJson);
  const previous = findLatestSnapshot_(row['Source Row Key']);
  const trigger = inferTrigger_(workItemType, row, previous);

  row['Current State Hash'] = hash;
  row['Previous State Hash'] = previous ? previous['State Hash'] : '';
  row['Last Processed At'] = '';
  row['Trigger Candidate'] = trigger.candidate;
  row['Communication Event'] = trigger.event;
  row['Dedupe Key'] = trigger.event ? workItemType + '|' + row['Source Row Key'] + '|' + trigger.event + '|' + hash : '';
  row['Hub Queue ID'] = '';
  row['Processing Error'] = '';
  return row;
}

function inferTrigger_(workItemType, row, previous) {
  if (!previous) {
    return { candidate: 'Initial snapshot', event: '' };
  }

  if (previous['State Hash'] === row['Current State Hash']) {
    return { candidate: '', event: '' };
  }

  if (workItemType === 'Project') {
    if (['YELLOW', 'RED'].indexOf(row['Normalized Status']) >= 0) {
      return { candidate: 'Material project status change', event: 'Unexpected status change' };
    }
    return { candidate: 'Project changed', event: '' };
  }

  if (workItemType === 'Gate') {
    if (row['Is Gate Missed'] === 'TRUE') {
      return { candidate: 'Gate missed', event: 'Gate missed / failed / delayed' };
    }
    if (row['Is Gate Approaching'] === 'TRUE') {
      return { candidate: 'Gate approaching', event: 'Gate approaching' };
    }
    return { candidate: 'Gate changed', event: '' };
  }

  if (workItemType === 'Production Release') {
    return { candidate: 'Release changed', event: row['Release Event'] || '' };
  }

  return { candidate: 'Changed', event: '' };
}

function recordSnapshotAndTrigger_(automation, row) {
  const snapshots = automation.getSheetByName(AUTOMATION.SHEETS.SNAPSHOTS);
  const triggerLog = automation.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG);
  const stateJson = JSON.stringify(row);

  appendByHeaders_(snapshots, AUTOMATION.HEADERS.SNAPSHOTS, {
    'Snapshot ID': Utilities.getUuid(),
    'Snapshot At': automationNowIso_(),
    'Work Item Type': row['Work Item Type'],
    'Flow ID': row['Flow ID'],
    'Source Row Key': row['Source Row Key'],
    'Source Sheet': row['Source Sheet'],
    'Source Row': row['Source Row'],
    'State Hash': row['Current State Hash'],
    'State JSON': stateJson
  });

  if (!row['Trigger Candidate']) return;

  appendByHeaders_(triggerLog, AUTOMATION.HEADERS.TRIGGER_LOG, {
    'Trigger Log ID': Utilities.getUuid(),
    'Created At': automationNowIso_(),
    'Work Item Type': row['Work Item Type'],
    'Flow ID': row['Flow ID'],
    'Source Row Key': row['Source Row Key'],
    'Trigger Candidate': row['Trigger Candidate'],
    'Communication Event': row['Communication Event'],
    'Old State Hash': row['Previous State Hash'],
    'New State Hash': row['Current State Hash'],
    'Old State Summary': '',
    'New State Summary': summarizeRow_(row),
    'Dedupe Key': row['Dedupe Key'],
    'Hub Queue ID': '',
    'Processing Status': row['Communication Event'] ? 'Pending Hub Draft' : 'Logged Only',
    'Processing Error': ''
  });
}

function writeNormalizedRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows.map(row => headers.map(header => row[header] || '')));
}

function readRows_(sheet, startRow, endRow) {
  const rowCount = Math.max(endRow - startRow + 1, 1);
  const colCount = sheet.getLastColumn();
  return sheet.getRange(startRow, 1, rowCount, colCount).getValues();
}

function getAutomationConfig_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(AUTOMATION.SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).reduce((obj, row) => {
    if (row[0]) obj[row[0]] = row[1];
    return obj;
  }, {});
}

function findLatestSnapshot_(sourceRowKey) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(AUTOMATION.SHEETS.SNAPSHOTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = getAutomationObjects_(sheet);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]['Source Row Key'] === sourceRowKey) return rows[i];
  }
  return null;
}

function appendByHeaders_(sheet, headers, row) {
  sheet.appendRow(headers.map(header => row[header] || ''));
}

function getAutomationObjects_(sheet) {
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

function normalizeStatus_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (['GREEN', 'YELLOW', 'RED', 'GRAY'].indexOf(text) >= 0) return text;
  if (/risk/i.test(text)) return 'YELLOW';
  if (/block|off/i.test(text)) return 'RED';
  if (/done|complete/i.test(text)) return 'GREEN';
  return text;
}

function normalizePhase_(value) {
  return String(value || '').trim();
}

function normalizeGateStatus_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (/pass|approved|complete/.test(text.toLowerCase())) return 'PASSED';
  if (/fail|miss|delay|blocked/.test(text.toLowerCase())) return 'MISSED';
  if (/pending|upcoming|planned/.test(text.toLowerCase())) return 'PENDING';
  return text;
}

function normalizeReleaseStatus_(phase) {
  const text = String(phase || '').toLowerCase();
  if (/complete|done|released/.test(text)) return 'COMPLETED';
  if (/start|progress|deploy/.test(text)) return 'STARTED';
  if (/delay|miss/.test(text)) return 'DELAYED';
  if (/rollback|rolled/.test(text)) return 'ROLLED_BACK';
  if (/schedule|planned/.test(text)) return 'SCHEDULED';
  return String(phase || '').trim();
}

function inferReleaseEvent_(phase, notes) {
  const text = (String(phase || '') + ' ' + String(notes || '')).toLowerCase();
  if (/rollback|rolled back/.test(text)) return 'Release rolled back';
  if (/delay|delayed|missed/.test(text)) return 'Release delayed';
  if (/complete|completed|done|released/.test(text)) return 'Release completed';
  if (/start|started|deploying/.test(text)) return 'Release started';
  if (/go|no-go|readiness/.test(text)) return 'Go / no-go approaching';
  if (/schedule|scheduled|planned/.test(text)) return 'Release scheduled';
  return '';
}

function daysUntil_(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  const today = new Date();
  const ms = date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.ceil(ms / 86400000);
}

function hashString_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function summarizeRow_(row) {
  if (row['Work Item Type'] === 'Project') {
    return row.Project + ' | ' + row.Status + ' | ' + row['Current Phase'] + ' | ' + row['Primary Risk'];
  }
  if (row['Work Item Type'] === 'Gate') {
    return row.Project + ' | ' + row.Gate + ' | ' + row['Gate Status'];
  }
  if (row['Work Item Type'] === 'Production Release') {
    return row.Project + ' | ' + row['Release Date'] + ' | ' + row.Phase;
  }
  return JSON.stringify(row);
}

function normalizeAutomationKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function automationNowIso_() {
  return new Date().toISOString();
}
