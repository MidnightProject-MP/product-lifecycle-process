var HUB_LOG_BUFFER_DEPTH = 0;
var HUB_RUN_LOG_BUFFER = [];
var HUB_SKILL_RUN_LOG_BUFFER = [];
var HUB_REVIEW_SYNC_DEFER_DEPTH = 0;
var HUB_REVIEW_SYNC_PENDING = false;

function setupHubSheets() {
  const ss = SpreadsheetApp.getActive();
  const queue = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const review = ensureSheet_(ss, HUB.SHEETS.REVIEW, HUB.HEADERS.REVIEW);
  const flowConsole = ensureSheet_(ss, HUB.SHEETS.FLOW_CONSOLE, HUB.HEADERS.FLOW_CONSOLE);
  const flowState = ensureSheet_(ss, HUB.SHEETS.FLOW_STATE, HUB.HEADERS.FLOW_STATE);
  const history = ensureSheet_(ss, HUB.SHEETS.HISTORY, HUB.HEADERS.HISTORY);
  ensureSheet_(ss, HUB.SHEETS.RUN_LOG, HUB.HEADERS.RUN_LOG);
  setupSkillSheets_();
  configureHubQueueSheet_(queue);
  configureHubReviewSheet_(review);
  configureFlowConsoleSheet_(flowConsole);
  configureHubPlainTextColumns_(queue);
  configureHubPlainTextColumns_(history);
  configureHubPlainTextColumns_(flowState);
  syncReviewSheetFromQueue_();
  hideInternalHubSheets_();
}

function setupControlCenter() {
  const ss = SpreadsheetApp.getActive();
  ensureControlCenterHomeSheet_(ss);
  setupRegistrySheets();
  setupAutomationSheets();
  setupHubSheets();
  hideInternalHubSheets_();
  return 'Personal Assistant Control Center setup complete.';
}

function resetHubForV2Dev() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HUB.HEADERS).forEach(key => {
    const sheetName = HUB.SHEETS[key];
    if (!sheetName) return;
    if (isGraphHubSheet_(sheetName)) return;
    resetSheetToHeaders_(ss, sheetName, HUB.HEADERS[key]);
  });
  resetSheetToHeaders_(ss, HUB.SHEETS.RUN_LOG_RAW, HUB.HEADERS.RUN_LOG);
  setupHubSheets();
  logHub_('INFO', 'resetHubForV2Dev', '', 'Hub reset to v2 dev schema.', {});
  return 'Hub reset to v2 dev schema.';
}

function resetControlCenterForDev() {
  const ss = SpreadsheetApp.getActive();
  ensureControlCenterHomeSheet_(ss);

  Object.keys(HUB.HEADERS).forEach(key => {
    const sheetName = HUB.SHEETS[key];
    if (!sheetName || isGraphHubSheet_(sheetName)) return;
    resetSheetToHeaders_(ss, sheetName, HUB.HEADERS[key]);
  });
  resetSheetToHeaders_(ss, HUB.SHEETS.RUN_LOG_RAW, HUB.HEADERS.RUN_LOG);

  Object.keys(REGISTRY.HEADERS).forEach(key => {
    const sheetName = REGISTRY.SHEETS[key];
    if (!sheetName) return;
    resetSheetToHeaders_(ss, sheetName, REGISTRY.HEADERS[key]);
  });

  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.RAW_PROJECTS, []);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.RAW_RELEASES, []);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.EXPORT_SOURCE, AUTOMATION.HEADERS.EXPORT);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.EXPORT, AUTOMATION.HEADERS.EXPORT);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.CHANGE_INDEX, AUTOMATION.HEADERS.CHANGE_INDEX);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS, AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.DASHBOARD_CHANGES, AUTOMATION.HEADERS.DASHBOARD_CHANGES);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS, AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.TRIGGER_LOG, AUTOMATION.HEADERS.TRIGGER_LOG);
  resetAutomationSheetForControlCenter_(ss, AUTOMATION.SHEETS.CONFIG, AUTOMATION.HEADERS.CONFIG);

  setupControlCenter();
  logHub_('INFO', 'resetControlCenterForDev', '', 'Control Center reset to clean v1 schema.', {});
  return 'Personal Assistant Control Center reset complete.';
}

function resetAutomationSheetForControlCenter_(ss, sheetName, headers) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  if (headers && headers.length) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function resetSheetToHeaders_(ss, sheetName, headers) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function seedHubPocData() {
  throw new Error('seedHubPocData is deprecated. Use the central Registry spreadsheet and run setupRegistrySheets().');
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui
    .createMenu('Personal Assistant')
    .addItem('Open Communication App', 'openCommunicationApp')
    .addItem('Sync Dashboard Now', 'showAutomationSyncResult')
    .addSeparator()
    .addSubMenu(ui.createMenu('Admin / Debug')
      .addItem('Setup Control Center', 'setupControlCenter')
      .addItem('Reset Control Center for Dev', 'resetControlCenterForDev')
      .addSeparator()
      .addItem('Open fallback sidebar console', 'openReviewControllerSidebar')
      .addItem('Open fallback wide console', 'openReviewController')
      .addSeparator()
      .addItem('Hide Internal Sheets', 'hideInternalHubSheets')
      .addItem('Show Internal Sheets', 'showInternalHubSheets')
      .addSeparator()
      .addItem('Refresh Review sheet', 'syncReviewSheetFromQueue')
      .addItem('Approve selected row(s)', 'approveSelectedQueueRows')
      .addItem('Discard selected row(s)', 'discardSelectedQueueRows')
      .addSeparator()
      .addItem('Refresh Flow Console', 'refreshFlowConsole')
      .addItem('Create draft from Flow Console', 'createDraftFromFlowConsole')
      .addSeparator()
      .addItem('Validate Automation Export', 'showAutomationExportValidation')
      .addItem('Enable sandbox draft creation', 'enableAutomationSandboxDraftCreation')
      .addItem('Disable draft creation', 'disableAutomationDraftCreation')
      .addSeparator()
      .addItem('Process approved rows', 'debugProcessApprovedQueueRows')
      .addItem('Check Hub configuration', 'debugCheckHubConfiguration')
      .addItem('Refresh Registry cache', 'clearHubRegistryCache'))
    .addToUi();
}

function hideInternalHubSheets() {
  hideInternalHubSheets_();
  SpreadsheetApp.getUi().alert('Internal sheets hidden. Use Show Internal Sheets if you need to inspect Queue or Review.');
}

function showInternalHubSheets() {
  const ss = SpreadsheetApp.getActive();
  getInternalHubSheetNames_().forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.showSheet();
  });
  SpreadsheetApp.getUi().alert('Internal sheets are visible.');
}

function hideInternalHubSheets_() {
  const ss = SpreadsheetApp.getActive();
  const active = ss.getActiveSheet();
  const internalNames = getInternalHubSheetNames_();
  const fallback = ss.getSheets().find(sheet => internalNames.indexOf(sheet.getName()) < 0 && !sheet.isSheetHidden());
  if (active && internalNames.indexOf(active.getName()) >= 0 && fallback) {
    ss.setActiveSheet(fallback);
  }

  internalNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.isSheetHidden()) return;
    if (ss.getSheets().filter(candidate => !candidate.isSheetHidden()).length <= 1) return;
    try {
      sheet.hideSheet();
    } catch (error) {
      logHub_('WARN', 'hideInternalHubSheets_', '', 'Skipped hiding internal sheet.', {
        sheet: name,
        error: error.message || String(error)
      });
    }
  });
}

function getInternalHubSheetNames_() {
  const names = [
    'Settings',
    'Event_Catalog',
    'Templates',
    'Template_Variables',
    'Event_Transitions',
    'Approval_Rules',
    'Raw_Executive_Projects',
    'Raw_Executive_Releases',
    'Automation_Export_Source',
    'Automation_Change_Index',
    'Automation_Export',
    'Dashboard_Observations',
    'Dashboard_Changes',
    'Dashboard_Snapshots',
    'Trigger_Log',
    'Config',
    HUB.SHEETS.RUN_LOG,
    HUB.SHEETS.SKILL_RUN_LOG,
    HUB.SHEETS.QUEUE,
    HUB.SHEETS.REVIEW,
    HUB.SHEETS.FLOW_CONSOLE
  ];
  return names;
}

function isGraphHubSheet_(sheetName) {
  return [
    HUB.SHEETS.GRAPH_ENTITIES,
    HUB.SHEETS.GRAPH_W_NODES,
    HUB.SHEETS.GRAPH_EDGES,
    HUB.SHEETS.GRAPH_EVENTS
  ].indexOf(sheetName) >= 0;
}

function ensureControlCenterHomeSheet_(ss) {
  const sheet = ss.getSheetByName('Control Center') || ss.insertSheet('Control Center', 0);
  sheet.getRange(1, 1).setValue('Personal Assistant Control Center');
  sheet.getRange(2, 1).setValue('Use Personal Assistant > Open Communication App to manage communications.');
  return sheet;
}

function onHubEdit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    logHub_('WARN', 'onHubEdit', '', 'Skipped because Hub processing lock was unavailable.', {});
    return;
  }

  try {
    withHubBufferedLogging_(function() {
      withHubDeferredReviewSync_(function() {
        handleHubEdit_(e);
      });
    });
  } finally {
    lock.releaseLock();
  }
}

function handleHubEdit_(e) {
  if (!e) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped because function was run manually without an event.', {});
    return;
  }

  if (!e.range) {
    const processed = processApprovedQueueRows_();
    if (processed > 0) {
      logHub_('INFO', 'onHubEdit', '', 'Processed approved rows after trigger arrived without an edit range.', {
        processed: processed,
        changeType: e.changeType || '',
        triggerUid: e.triggerUid || ''
      });
    }
    return;
  }

  const sheet = e.range.getSheet();
  if (sheet.getName() === HUB.SHEETS.REVIEW) {
    handleReviewEdit_(e, sheet);
    return;
  }

  if (sheet.getName() === HUB.SHEETS.FLOW_CONSOLE) {
    handleFlowConsoleEdit_(e, sheet);
    return;
  }

  if (sheet.getName() !== HUB.SHEETS.QUEUE) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped edit outside Queue, Review, or Flow Console.', { sheet: sheet.getName() });
    return;
  }

  const headers = getHeaders_(sheet);
  const statusColumn = headers.indexOf('Status') + 1;
  if (statusColumn < 1) throw new Error('Queue sheet is missing Status header.');

  const editedRange = describeHubEditRange_(e.range, headers);
  if (!editedRange.includesStatusColumn) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped edit outside Status column.', editedRange);
    return;
  }

  if (e.range.getRow() === 1) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped header row edit.', editedRange);
    return;
  }

  const firstRow = Math.max(e.range.getRow(), 2);
  const lastRow = e.range.getLastRow();
  const queueIds = getQueueIdsFromRows_(sheet, firstRow, lastRow);
  queueIds.forEach(queueId => processQueueRowByQueueIdIfApproved_(sheet, queueId, 'onHubEdit', editedRange));
}

function processQueueRowByQueueIdIfApproved_(sheet, queueId, fn, details) {
  const row = findQueueRowByQueueId_(sheet, queueId);
  if (!row) {
    logHub_('INFO', fn, queueId, 'Skipped because Queue row no longer exists.', details || {});
    return;
  }

  const item = getRowObject_(sheet, row);
  const currentStatus = String(item.Status || '').trim();
  const stableQueueId = item['Queue ID'] || queueId || '';
  const logDetails = Object.assign({ row: row, status: currentStatus }, details || {});
  logHub_('INFO', fn, stableQueueId, 'Status column edit detected.', logDetails);

  if (currentStatus !== HUB.STATUS.APPROVED) {
    logHub_('INFO', fn, stableQueueId, 'Skipped because status is not Approved.', { row: row, status: currentStatus });
    return;
  }

  runSkillOrThrow_('approve_draft', {
    queueId: stableQueueId,
    row: row
  });
}

function approveSelectedQueueRows() {
  updateSelectedQueueRowsStatus_(HUB.STATUS.APPROVED, true);
}

function discardSelectedQueueRows() {
  updateSelectedQueueRowsStatus_(HUB.STATUS.DISCARDED, false);
}

function updateSelectedQueueRowsStatus_(status, shouldProcess) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    logHub_('WARN', 'updateSelectedQueueRowsStatus_', '', 'Skipped because Hub processing lock was unavailable.', {
      status: status
    });
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet || [HUB.SHEETS.QUEUE, HUB.SHEETS.REVIEW].indexOf(sheet.getName()) < 0) {
      SpreadsheetApp.getUi().alert('Select one or more rows in the Queue or Review sheet first.');
      return;
    }

    const range = sheet.getActiveRange();
    if (!range) {
      SpreadsheetApp.getUi().alert('Select one or more Queue rows first.');
      return;
    }

    if (sheet.getName() === HUB.SHEETS.REVIEW) {
      updateSelectedReviewRowsDecision_(sheet, range, status === HUB.STATUS.APPROVED ? HUB.REVIEW_DECISION.APPROVE : HUB.REVIEW_DECISION.DISCARD);
      return;
    }

    const headers = getHeaders_(sheet);
    const statusColumn = headers.indexOf('Status') + 1;
    if (statusColumn < 1) throw new Error('Queue sheet is missing Status header.');

    const firstRow = Math.max(range.getRow(), 2);
    const lastRow = range.getLastRow();
    const queueIds = getQueueIdsFromRows_(sheet, firstRow, lastRow);
    let changed = 0;

    queueIds.forEach(queueId => {
      const row = findQueueRowByQueueId_(sheet, queueId);
      if (!row) return;

      if (status === HUB.STATUS.APPROVED) {
        runSkillOrThrow_('approve_draft', {
          queueId: queueId,
          row: row
        });
      } else if (status === HUB.STATUS.DISCARDED) {
        runSkillOrThrow_('discard_draft', {
          queueId: queueId,
          row: row,
          reason: 'Discarded from Personal Assistant menu.'
        });
      } else {
        updateRowFields_(sheet, row, {
          Status: status,
          'Updated At': nowIso_(),
          Error: ''
        });
      }

      changed++;
      logHub_('INFO', 'updateSelectedQueueRowsStatus_', queueId, 'Menu updated Queue row status.', {
        row: row,
        status: status,
        shouldProcess: shouldProcess
      });
    });

    if (!shouldProcess) syncReviewSheetFromQueueSafe_();
    SpreadsheetApp.getUi().alert('Updated ' + changed + ' Queue row(s) to ' + status + '.');
  } finally {
    lock.releaseLock();
  }
}

function updateSelectedReviewRowsDecision_(sheet, range, decision) {
  const headers = getHeaders_(sheet);
  const decisionColumn = headers.indexOf('Decision') + 1;
  if (decisionColumn < 1) throw new Error('Review sheet is missing Decision header.');

  const firstRow = Math.max(range.getRow(), 2);
  const lastRow = range.getLastRow();
  const queueIdColumn = headers.indexOf('Queue ID') + 1;
  if (queueIdColumn < 1) throw new Error('Review sheet is missing Queue ID header.');

  const rowCount = lastRow - firstRow + 1;
  const selected = sheet.getRange(firstRow, queueIdColumn, rowCount, 1).getValues()
    .map((rowValues, index) => ({
      reviewRow: firstRow + index,
      queueId: rowValues[0]
    }));
  let changed = 0;
  let skipped = 0;

  selected.forEach(item => {
    if (!item.queueId) {
      skipped++;
      return;
    }

    processReviewDecisionByQueueId_(item.queueId, decision, {
      reviewRow: item.reviewRow,
      source: 'menu'
    });
    changed++;
  });

  SpreadsheetApp.getUi().alert('Processed ' + changed + ' Review row(s).' + (skipped ? ' Skipped ' + skipped + ' blank row(s).' : ''));
}

function getQueueIdsFromRows_(sheet, firstRow, lastRow) {
  const headers = getHeaders_(sheet);
  const queueIdColumn = headers.indexOf('Queue ID') + 1;
  if (queueIdColumn < 1) throw new Error('Queue sheet is missing Queue ID header.');
  if (lastRow < firstRow) return [];

  return sheet.getRange(firstRow, queueIdColumn, lastRow - firstRow + 1, 1).getValues()
    .map(rowValues => rowValues[0])
    .filter(queueId => queueId);
}

function configureHubQueueSheet_(sheet) {
  sheet.setFrozenRows(1);
  const headers = getHeaders_(sheet);
  const statusColumn = headers.indexOf('Status') + 1;
  if (statusColumn < 1) return;

  const statuses = Object.keys(HUB.STATUS).map(key => HUB.STATUS[key]);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(statuses, true)
    .setAllowInvalid(false)
    .build();
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  applyHubColumnValidation_(sheet, statusColumn, rows, rule, 'Status');
}

function configureHubReviewSheet_(sheet) {
  sheet.setFrozenRows(1);
  const headers = getHeaders_(sheet);
  const decisionColumn = headers.indexOf('Decision') + 1;
  if (decisionColumn < 1) return;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['', HUB.REVIEW_DECISION.APPROVE, HUB.REVIEW_DECISION.DISCARD], true)
    .setAllowInvalid(false)
    .build();
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  applyHubColumnValidation_(sheet, decisionColumn, rows, rule, 'Decision');
}

function applyHubColumnValidation_(sheet, column, rows, rule, label) {
  try {
    sheet.getRange(2, column, rows, 1).setDataValidation(rule);
  } catch (error) {
    logHub_('WARN', 'applyHubColumnValidation_', '', 'Skipped dropdown validation because the sheet rejected it.', {
      sheet: sheet.getName(),
      column: column,
      label: label,
      error: error.message || String(error)
    });
  }
}

function describeHubEditRange_(range, headers) {
  const firstColumn = range.getColumn();
  const lastColumn = range.getLastColumn();
  const statusColumn = headers.indexOf('Status') + 1;
  const editedHeaders = [];
  for (let col = firstColumn; col <= lastColumn; col++) {
    editedHeaders.push(headers[col - 1] || '');
  }

  return {
    a1Notation: range.getA1Notation(),
    row: range.getRow(),
    lastRow: range.getLastRow(),
    column: firstColumn,
    lastColumn: lastColumn,
    numRows: range.getNumRows(),
    numColumns: range.getNumColumns(),
    editedHeaders: editedHeaders,
    statusColumn: statusColumn,
    includesStatusColumn: statusColumn >= firstColumn && statusColumn <= lastColumn
  };
}

function handleReviewEdit_(e, sheet) {
  const headers = getHeaders_(sheet);
  const decisionColumn = headers.indexOf('Decision') + 1;
  if (decisionColumn < 1) throw new Error('Review sheet is missing Decision header.');

  const editedRange = describeHubEditRange_(e.range, headers);
  editedRange.decisionColumn = decisionColumn;
  editedRange.includesDecisionColumn = decisionColumn >= editedRange.column && decisionColumn <= editedRange.lastColumn;

  if (!editedRange.includesDecisionColumn) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped Review edit outside Decision column.', editedRange);
    return;
  }

  if (e.range.getRow() === 1) {
    logHub_('INFO', 'onHubEdit', '', 'Skipped Review header row edit.', editedRange);
    return;
  }

  const firstRow = Math.max(e.range.getRow(), 2);
  const lastRow = e.range.getLastRow();
  getReviewDecisionSnapshots_(sheet, firstRow, lastRow).forEach(item => {
    processReviewDecisionSnapshot_(sheet, item);
  });
}

function processReviewDecisionRow_(reviewSheet, row) {
  const item = getRowObject_(reviewSheet, row);
  processReviewDecisionSnapshot_(reviewSheet, {
    reviewRow: row,
    queueId: item['Queue ID'],
    decision: String(item.Decision || '').trim()
  });
}

function processReviewDecisionSnapshot_(reviewSheet, item) {
  const decision = String(item.decision || '').trim();
  const queueId = item.queueId;
  if (!queueId && !decision) {
    return;
  }

  if (!queueId) {
    updateRowFields_(reviewSheet, item.reviewRow, { Decision: '' });
    logHub_('INFO', 'processReviewDecisionRow_', '', 'Skipped blank Review row with decision value.', {
      row: item.reviewRow,
      decision: decision
    });
    return;
  }

  if (!decision) {
    logHub_('INFO', 'processReviewDecisionRow_', queueId, 'Skipped Review row with blank decision.', { row: item.reviewRow });
    return;
  }

  processReviewDecisionByQueueId_(queueId, decision, {
    reviewRow: item.reviewRow,
    source: 'review-edit'
  });
}

function getReviewDecisionSnapshots_(sheet, firstRow, lastRow) {
  const headers = getHeaders_(sheet);
  const queueIdIndex = headers.indexOf('Queue ID');
  const decisionIndex = headers.indexOf('Decision');
  if (queueIdIndex < 0) throw new Error('Review sheet is missing Queue ID header.');
  if (decisionIndex < 0) throw new Error('Review sheet is missing Decision header.');
  if (lastRow < firstRow) return [];

  return sheet.getRange(firstRow, 1, lastRow - firstRow + 1, headers.length).getValues()
    .map((rowValues, index) => ({
      reviewRow: firstRow + index,
      queueId: rowValues[queueIdIndex],
      decision: String(rowValues[decisionIndex] || '').trim()
    }));
}

function processReviewDecisionByQueueId_(queueId, decision, details) {
  const queueSheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  if (!queueSheet) throw new Error('Queue sheet is missing.');
  const queueRow = findQueueRowByQueueId_(queueSheet, queueId);
  if (!queueRow) throw new Error('Queue row not found for Queue ID: ' + queueId);

  if (decision === HUB.REVIEW_DECISION.APPROVE) {
    logHub_('INFO', 'processReviewDecisionByQueueId_', queueId, 'Review approved Queue row.', Object.assign({}, details || {}, {
      queueRow: queueRow
    }));
    runSkillOrThrow_('approve_draft', {
      queueId: queueId,
      row: queueRow
    });
    return;
  }

  if (decision === HUB.REVIEW_DECISION.DISCARD) {
    logHub_('INFO', 'processReviewDecisionByQueueId_', queueId, 'Review discarded Queue row.', Object.assign({}, details || {}, {
      queueRow: queueRow
    }));
    runSkillOrThrow_('discard_draft', {
      queueId: queueId,
      row: queueRow,
      reason: 'Discarded from Review sheet.'
    });
    return;
  }

  logHub_('WARN', 'processReviewDecisionByQueueId_', queueId, 'Skipped Review row with unsupported decision.', Object.assign({}, details || {}, {
    decision: decision
  }));
}

function syncReviewSheetFromQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    logHub_('WARN', 'syncReviewSheetFromQueue', '', 'Skipped because Hub processing lock was unavailable.', {});
    return;
  }

  try {
    syncReviewSheetFromQueue_();
  } finally {
    lock.releaseLock();
  }
}

function syncReviewSheetFromQueue_() {
  const ss = SpreadsheetApp.getActive();
  const queueSheet = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const reviewSheet = ensureSheet_(ss, HUB.SHEETS.REVIEW, HUB.HEADERS.REVIEW);
  const reviewRows = getObjects_(queueSheet)
    .filter(row => [HUB.STATUS.DRAFT, HUB.STATUS.ERROR, HUB.STATUS.SCHEDULED].indexOf(String(row.Status || '').trim()) >= 0)
    .map(buildReviewRowFromQueueRow_);

  writeObjectsToSheet_(reviewSheet, HUB.HEADERS.REVIEW, reviewRows);
  logHub_('INFO', 'syncReviewSheetFromQueue_', '', 'Review sheet synced from Queue.', {
    rows: reviewRows.length
  });
}

function syncReviewSheetFromQueueSafe_() {
  if (isHubReviewSyncDeferred_()) {
    HUB_REVIEW_SYNC_PENDING = true;
    return;
  }

  try {
    syncReviewSheetFromQueue_();
  } catch (error) {
    logHub_('WARN', 'syncReviewSheetFromQueueSafe_', '', 'Failed to sync Review sheet.', {
      error: error.message || String(error)
    });
  }
}

function buildReviewRowFromQueueRow_(queueRow) {
  queueRow = hydrateCommunicationObject_(queueRow);
  const payload = normalizePayload_(queueRow);
  return {
    Decision: '',
    'Queue ID': queueRow['Queue ID'],
    Subject: payload.subject || payload.project || payload.release_name || payload.issue_title || queueRow['Flow ID'],
    Event: getEventDisplayNameSafe_(queueRow['Event Key']),
    Status: queueRow.Status,
    Owner: queueRow.Owner || payload.owner,
    What: payload.what || '',
    'So What': payload.so_what || '',
    "What's Next": payload.whats_next || '',
    Error: queueRow.Error || '',
    Slack: queueRow['Slack Message URL'] || ''
  };
}

function writeObjectsToSheet_(sheet, headers, rows) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const existingRows = Math.max(sheet.getLastRow() - 1, 0);
  const rowsToClear = Math.max(existingRows, rows.length);
  if (rowsToClear > 0) {
    sheet.getRange(2, 1, rowsToClear, headers.length).clearContent();
  }

  if (rows.length) {
    configureHubPlainTextRows_(sheet, 2, rows.length);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows.map(row => headers.map(header => normalizeHubCellValue_(header, row[header]))));
  }
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
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

function getObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const object = headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
    return hydrateCommunicationObject_(object);
  });
}

function logHub_(level, fn, queueId, message, details) {
  const values = [
    uuid_(),
    new Date(),
    level,
    fn,
    queueId || '',
    message,
    stringifyHubLogDetails_(details)
  ];

  if (isHubLogBuffering_()) {
    bufferHubLogValues_(values);
    return;
  }

  try {
    const ss = SpreadsheetApp.getActive();
    writeHubLogValues_(ss, HUB.SHEETS.RUN_LOG, values);
  } catch (error) {
    try {
      const ss = SpreadsheetApp.getActive();
      writeHubLogValues_(ss, HUB.SHEETS.RUN_LOG_RAW, values);
      console.log(JSON.stringify({
        level: 'WARN',
        loggingFunctionName: 'logHub_',
        originalFunctionName: fn,
        queueId: queueId || '',
        message: 'Primary Run_Log write failed while recording a log event; wrote to Run_Log_Raw.',
        details: {
          originalLevel: level,
          originalMessage: message,
          runLogWriteError: error.message || String(error)
        }
      }));
    } catch (fallbackError) {
      console.log(JSON.stringify({
        level: level,
        loggingFunctionName: 'logHub_',
        originalFunctionName: fn,
        queueId: queueId || '',
        message: 'Both Run_Log and Run_Log_Raw writes failed while recording a log event.',
        details: details || {},
        originalMessage: message,
        runLogWriteError: error.message || String(error),
        rawRunLogWriteError: fallbackError.message || String(fallbackError)
      }));
    }
  }
}

function stringifyHubLogDetails_(details) {
  if (!details) return '';
  const text = JSON.stringify(details);
  return text.length > 1000 ? text.slice(0, 997) + '...' : text;
}

function withHubBufferedLogging_(callback) {
  HUB_LOG_BUFFER_DEPTH++;
  try {
    return callback();
  } finally {
    HUB_LOG_BUFFER_DEPTH--;
    if (HUB_LOG_BUFFER_DEPTH === 0) flushHubLogBuffers_();
  }
}

function isHubLogBuffering_() {
  return HUB_LOG_BUFFER_DEPTH > 0;
}

function withHubDeferredReviewSync_(callback) {
  HUB_REVIEW_SYNC_DEFER_DEPTH++;
  try {
    return callback();
  } finally {
    HUB_REVIEW_SYNC_DEFER_DEPTH--;
    if (HUB_REVIEW_SYNC_DEFER_DEPTH === 0) flushHubReviewSyncIfNeeded_();
  }
}

function isHubReviewSyncDeferred_() {
  return HUB_REVIEW_SYNC_DEFER_DEPTH > 0;
}

function flushHubReviewSyncIfNeeded_() {
  if (!HUB_REVIEW_SYNC_PENDING) return;
  HUB_REVIEW_SYNC_PENDING = false;
  syncReviewSheetFromQueueSafe_();
}

function bufferHubLogValues_(values) {
  HUB_RUN_LOG_BUFFER.push(values);
}

function bufferSkillRunLogObject_(object) {
  HUB_SKILL_RUN_LOG_BUFFER.push(object);
}

function flushHubLogBuffers_() {
  const runLogRows = HUB_RUN_LOG_BUFFER.slice();
  const skillLogObjects = HUB_SKILL_RUN_LOG_BUFFER.slice();
  HUB_RUN_LOG_BUFFER = [];
  HUB_SKILL_RUN_LOG_BUFFER = [];

  if (!runLogRows.length && !skillLogObjects.length) return;

  try {
    const ss = SpreadsheetApp.getActive();
    if (runLogRows.length) writeHubLogValuesRows_(ss, HUB.SHEETS.RUN_LOG, runLogRows);
    if (skillLogObjects.length) writeSkillRunLogObjects_(skillLogObjects);
  } catch (error) {
    console.log(JSON.stringify({
      level: 'WARN',
      functionName: 'flushHubLogBuffers_',
      message: 'Failed to flush buffered Hub logs.',
      details: {
        runLogRowCount: runLogRows.length,
        skillLogRowCount: skillLogObjects.length,
        error: error.message || String(error)
      }
    }));
  }
}

function writeHubLogValues_(ss, sheetName, values) {
  const sheet = ensureLogSheet_(ss, sheetName);
  insertValuesAtTop_(sheet, values);
}

function writeHubLogValuesRows_(ss, sheetName, valuesRows) {
  const sheet = ensureLogSheet_(ss, sheetName);
  insertValuesRowsAtTop_(sheet, valuesRows.slice().reverse());
}

function ensureLogSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HUB.HEADERS.RUN_LOG.length).setValues([HUB.HEADERS.RUN_LOG]);
  }
  return sheet;
}

function insertValuesAtTop_(sheet, values) {
  insertValuesRowsAtTop_(sheet, [values]);
}

function insertValuesRowsAtTop_(sheet, valuesRows) {
  const rows = valuesRows || [];
  if (!rows.length) return;
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const values = rows.map(row => {
    const normalized = row.slice();
    while (normalized.length < columnCount) normalized.push('');
    return normalized;
  });
  let inserted = false;
  try {
    sheet.insertRowsBefore(2, values.length);
    inserted = true;
    configureHubPlainTextRows_(sheet, 2, values.length);
    sheet.getRange(2, 1, values.length, columnCount).setValues(values);
  } catch (error) {
    if (inserted) {
      try {
        sheet.deleteRows(2, values.length);
      } catch (deleteError) {
        console.log('Failed to roll back inserted row on ' + sheet.getName() + ': ' + deleteError);
      }
    }
    throw error;
  }
}

function configureHubPlainTextRow_(sheet, row) {
  configureHubPlainTextRows_(sheet, row, 1);
}

function configureHubPlainTextRows_(sheet, startRow, rowCount) {
  if (!rowCount || rowCount < 1) return;
  const headers = getHeaders_(sheet);
  headers.forEach((header, index) => {
    if (!shouldPreserveHubCellAsText_(header)) return;
    sheet.getRange(startRow, index + 1, rowCount, 1).setNumberFormat('@');
  });
}

function configureHubPlainTextColumns_(sheet) {
  const headers = getHeaders_(sheet);
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  headers.forEach((header, index) => {
    if (!shouldPreserveHubCellAsText_(header)) return;
    sheet.getRange(2, index + 1, rows, 1).setNumberFormat('@');
  });
}

function normalizeHubCellValue_(header, value) {
  if (value == null) return '';
  if (!shouldPreserveHubCellAsText_(header)) return value;
  return String(value);
}

function shouldPreserveHubCellAsText_(header) {
  return [
    'History ID',
    'Slack Thread ID',
    'Slack Thread TS',
    'Slack Message TS',
    'Test Slack Thread TS',
    'Test Slack Message TS',
    'Test Anchor Message TS',
    'Test Thread TS',
    'Test Latest Reply TS',
    'Anchor Message TS',
    'Thread TS',
    'Latest Reply TS',
    'Run ID',
    'Parent Run ID',
    'Input Hash',
    'Flow ID',
    'Entity ID',
    'W Node ID',
    'Edge ID',
    'Source Node ID',
    'Target Node ID',
    'Payload Hash'
  ].indexOf(header) >= 0;
}

function hydrateCommunicationObject_(object) {
  if (!object || typeof object !== 'object') return object;

  const payload = parseJsonObject_(object['Payload JSON']);
  if (!object.Lane && payload.lane) object.Lane = payload.lane;
  if (!object.Priority && payload.priority) object.Priority = payload.priority;
  if (!object['Parent Queue ID'] && payload.parent_queue_id) object['Parent Queue ID'] = payload.parent_queue_id;
  if (!object['Expected Previous Event Key'] && payload.expected_previous_event_key) object['Expected Previous Event Key'] = payload.expected_previous_event_key;
  if (!object['Path Override'] && payload.path_override) object['Path Override'] = payload.path_override;
  if (!object['Scheduled For'] && payload.scheduled_for) object['Scheduled For'] = payload.scheduled_for;
  if (!object['Slack Thread ID'] && object['Slack Thread TS']) object['Slack Thread ID'] = object['Slack Thread TS'];
  if (!object.Status && object['Final Status']) object.Status = object['Final Status'];
  if (!object['Sent At'] && object['Completed At']) object['Sent At'] = object['Completed At'];
  return object;
}

function getEventDisplayNameSafe_(eventKey) {
  try {
    return getEventDisplayName_(eventKey);
  } catch (error) {
    return eventKey || '';
  }
}
