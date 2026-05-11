function appendQueueDraft_(draft) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const dedupeKey = draft['Dedupe Key'] || buildDedupeKey_(draft);
  const existingQueueId = findActiveQueueIdByDedupeKey_(sheet, dedupeKey);
  if (existingQueueId) return existingQueueId;

  const rowObject = Object.assign({
    'Queue ID': uuid_(),
    'Flow ID': draft['Flow ID'] || buildFlowId_(draft),
    'Dedupe Key': dedupeKey,
    'Created At': nowIso_(),
    'Updated At': nowIso_(),
    'Status': HUB.STATUS.DRAFT
  }, draft);

  appendObjectRow_(sheet, rowObject);
  return rowObject['Queue ID'];
}

function sendApprovedQueueRow_(sheet, row) {
  const item = getRowObject_(sheet, row);

  try {
    if (!item['Approved At']) {
      updateRowFields_(sheet, row, { 'Approved At': nowIso_() });
    }
    const template = findTemplate_(item);
    applyTemplateDefaults_(sheet, row, item, template);
    const hydratedItem = getRowObject_(sheet, row);
    const text = renderTemplate_(template.Text, hydratedItem);
    const channel = hydratedItem.Channel || resolveDefaultChannel_(template['Default Channel Type']);
    const threadTs = resolveThreadTs_(template, hydratedItem);
    const result = postSlackMessage_(channel, text, threadTs);

    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.SENT,
      'Updated At': nowIso_(),
      'Sent At': nowIso_(),
      'Slack Thread ID': threadTs || result.ts,
      'Slack Message URL': result.permalink || '',
      'Error': ''
    });
    appendHistoryFromQueueRow_(sheet, row);
  } catch (error) {
    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.ERROR,
      'Updated At': nowIso_(),
      'Error': error.message || String(error)
    });
  }
}

function applyTemplateDefaults_(sheet, row, item, template) {
  const updates = {};
  if (!item['Send Rule'] && template['Default Send Rule']) {
    updates['Send Rule'] = template['Default Send Rule'];
  }
  if (!item.Channel && template['Default Channel Type']) {
    updates.Channel = resolveDefaultChannel_(template['Default Channel Type']);
  }
  if (Object.keys(updates).length) updateRowFields_(sheet, row, updates);
}

function appendHistoryFromQueueRow_(queueSheet, row) {
  const ss = SpreadsheetApp.getActive();
  const historySheet = ensureSheet_(ss, HUB.SHEETS.HISTORY, HUB.HEADERS.HISTORY);
  const item = getRowObject_(queueSheet, row);
  appendObjectRow_(historySheet, item);
}

function getRowObject_(sheet, row) {
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  return headers.reduce((obj, header, index) => {
    obj[header] = values[index];
    return obj;
  }, {});
}

function appendObjectRow_(sheet, object) {
  const headers = getHeaders_(sheet);
  const values = headers.map(header => object[header] || '');
  sheet.appendRow(values);
}

function updateRowFields_(sheet, row, fields) {
  const headers = getHeaders_(sheet);
  Object.keys(fields).forEach(key => {
    const col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(row, col).setValue(fields[key]);
  });
}

function findActiveQueueIdByDedupeKey_(sheet, dedupeKey) {
  if (!dedupeKey) return '';
  const rows = getObjects_(sheet);
  const active = rows.find(row =>
    row['Dedupe Key'] === dedupeKey &&
    [HUB.STATUS.DRAFT, HUB.STATUS.APPROVED].indexOf(row.Status) >= 0
  );
  return active ? active['Queue ID'] : '';
}

function buildFlowId_(draft) {
  const lane = String(draft.Lane || 'flow').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const project = String(draft.Project || draft['Release ID'] || uuid_()).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return lane + '-' + project;
}

function buildDedupeKey_(draft) {
  return [
    draft.Source || '',
    draft.Lane || '',
    draft['Communication Event'] || '',
    draft.Project || '',
    draft.What || ''
  ].join('|');
}

function resolveThreadTs_(template, item) {
  if (item['Slack Thread ID']) return shouldReplyInThread_(template, item) ? item['Slack Thread ID'] : '';
  if (!shouldReplyInThread_(template, item)) return '';

  const priorThread = findThreadForFlow_(item['Flow ID']);
  return priorThread || '';
}

function findThreadForFlow_(flowId) {
  if (!flowId) return '';
  const ss = SpreadsheetApp.getActive();
  const historySheet = ss.getSheetByName(HUB.SHEETS.HISTORY);
  if (!historySheet) return '';

  const rows = getObjects_(historySheet)
    .filter(row => row['Flow ID'] === flowId && row['Slack Thread ID'])
    .reverse();

  return rows.length ? rows[0]['Slack Thread ID'] : '';
}

function buildWeeklyProjectDigestDraft() {
  const dashboardId = getScriptProperty_('DASHBOARD_SPREADSHEET_ID');
  if (!dashboardId) throw new Error('Missing DASHBOARD_SPREADSHEET_ID script property.');

  const dashboard = SpreadsheetApp.openById(dashboardId);
  const projectSheet = dashboard.getSheetByName('Projects');
  if (!projectSheet) throw new Error('Projects sheet is missing in dashboard.');

  const projects = getObjects_(projectSheet).filter(row => row.Project);
  const active = projects.filter(row => String(row.Status || '').toLowerCase() !== 'done');
  const what = active.map(row => {
    return '- ' + row.Project +
      ' | Phase: ' + (row['Current Phase'] || 'TBD') +
      ' | Status: ' + (row.Status || 'TBD') +
      ' | Risk: ' + (row['Primary Risk'] || 'None listed') +
      ' | Next Gate: ' + (row['Next Major Gate'] || 'TBD') +
      ' (' + (row['Next Gate ETA'] || 'TBD') + ')';
  }).join('\n') || 'No active projects found.';

  return appendQueueDraft_({
    Source: 'Scheduled Digest',
    Lane: 'Project',
    'Communication Event': 'Weekly project digest item',
    'Lifecycle Stage': 'All',
    Scenario: 'Weekly Digest',
    Priority: 'Medium',
    Project: 'Weekly Project Digest',
    Owner: 'TPM',
    'Template Key': 'project-weekly-digest',
    'Flow ID': 'project-weekly-digest-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd'),
    'Dedupe Key': 'weekly-project-digest|' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd'),
    What: what,
    'So What': 'This is the heartbeat summary for active project movement, risks, and gates.',
    "What's Next": 'Review exceptions, decisions, and high-risk gates. Approve this draft to send the weekly digest.'
  });
}
