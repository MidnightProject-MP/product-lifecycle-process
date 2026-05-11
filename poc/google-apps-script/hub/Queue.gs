function appendQueueDraft_(draft) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const dedupeKey = draft['Dedupe Key'] || buildDedupeKey_(draft);
  const existingQueueId = findActiveQueueIdByDedupeKey_(sheet, dedupeKey);
  if (existingQueueId) {
    logHub_('INFO', 'appendQueueDraft_', existingQueueId, 'Skipped duplicate active draft.', { dedupeKey: dedupeKey });
    return existingQueueId;
  }

  const rowObject = Object.assign({
    'Queue ID': uuid_(),
    'Flow ID': draft['Flow ID'] || buildFlowId_(draft),
    'Dedupe Key': dedupeKey,
    'Created At': nowIso_(),
    'Updated At': nowIso_(),
    'Status': HUB.STATUS.DRAFT
  }, draft);

  appendObjectRow_(sheet, rowObject);
  logHub_('INFO', 'appendQueueDraft_', rowObject['Queue ID'], 'Draft appended to Queue.', {
    lane: rowObject.Lane,
    event: rowObject['Communication Event'],
    templateKey: rowObject['Template Key']
  });
  return rowObject['Queue ID'];
}

function sendApprovedQueueRow_(sheet, row) {
  const item = getRowObject_(sheet, row);

  try {
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Preparing approved queue row.', {
      row: row,
      lane: item.Lane,
      event: item['Communication Event'],
      templateKey: item['Template Key']
    });
    if (!item['Approved At']) {
      updateRowFields_(sheet, row, { 'Approved At': nowIso_() });
    }
    const template = findTemplate_(item);
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Template found.', {
      templateKey: template['Template Key'],
      postMode: template['Post Mode'],
      defaultChannelType: template['Default Channel Type']
    });
    applyTemplateDefaults_(sheet, row, item, template);
    const hydratedItem = getRowObject_(sheet, row);
    const text = renderTemplate_(template.Text, hydratedItem);
    const channel = hydratedItem.Channel || resolveDefaultChannel_(template['Default Channel Type']);
    const threadTs = resolveThreadTs_(template, hydratedItem);
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Posting Slack message.', {
      channel: channel,
      threadTs: threadTs,
      textLength: text.length
    });
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
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Slack message sent and history recorded.', {
      slackThreadId: threadTs || result.ts,
      permalink: result.permalink || ''
    });
  } catch (error) {
    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.ERROR,
      'Updated At': nowIso_(),
      'Error': error.message || String(error)
    });
    logHub_('ERROR', 'sendApprovedQueueRow_', item['Queue ID'], 'Failed to send approved queue row.', {
      error: error.message || String(error),
      stack: error.stack || ''
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
  if (Object.keys(updates).length) {
    updateRowFields_(sheet, row, updates);
    logHub_('INFO', 'applyTemplateDefaults_', item['Queue ID'], 'Applied template defaults.', updates);
  }
}

function appendHistoryFromQueueRow_(queueSheet, row) {
  const ss = SpreadsheetApp.getActive();
  const historySheet = ensureSheet_(ss, HUB.SHEETS.HISTORY, HUB.HEADERS.HISTORY);
  const item = getRowObject_(queueSheet, row);
  appendObjectRow_(historySheet, item);
  logHub_('INFO', 'appendHistoryFromQueueRow_', item['Queue ID'], 'Copied queue row to History.', {
    flowId: item['Flow ID'],
    status: item.Status
  });
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
  logHub_('INFO', 'resolveThreadTs_', item['Queue ID'], 'Resolved thread from history.', {
    flowId: item['Flow ID'],
    priorThread: priorThread
  });
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

function debugSendQueueRow(rowNumber) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet) throw new Error('Queue sheet is missing.');
  sendApprovedQueueRow_(sheet, rowNumber);
}
