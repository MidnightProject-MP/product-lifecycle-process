function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Communication Automation')
    .addItem('Setup sheets', 'setupAutomationSheets')
    .addSeparator()
    .addItem('Enable sandbox draft creation', 'enableAutomationSandboxDraftCreation')
    .addItem('Disable draft creation', 'disableAutomationDraftCreation')
    .addSeparator()
    .addItem('Validate export', 'showAutomationExportValidation')
    .addItem('Run dashboard sync', 'showAutomationSyncResult')
    .addToUi();
}

function setupAutomationSheets() {
  const ss = SpreadsheetApp.getActive();

  ensureAutomationRawSheet_(ss, AUTOMATION.SHEETS.RAW_PROJECTS);
  ensureAutomationRawSheet_(ss, AUTOMATION.SHEETS.RAW_RELEASES);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.EXPORT_SOURCE, AUTOMATION.HEADERS.EXPORT);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.EXPORT, AUTOMATION.HEADERS.EXPORT);
  ensureAutomationChangeIndexSheet_(ss);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS, AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.DASHBOARD_CHANGES, AUTOMATION.HEADERS.DASHBOARD_CHANGES);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS, AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.TRIGGER_LOG, AUTOMATION.HEADERS.TRIGGER_LOG);

  const config = ensureAutomationSheet_(ss, AUTOMATION.SHEETS.CONFIG, AUTOMATION.HEADERS.CONFIG);
  seedAutomationConfig_(config);
}

function syncLeadershipDashboardToAutomation() {
  const startedAt = new Date().getTime();
  setupAutomationSheets();

  const automation = SpreadsheetApp.getActive();
  const config = getAutomationConfig_();
  const pollCount = incrementAutomationPollCount_(automation, config);
  config.POLL_COUNT = String(pollCount);
  const fastPreflight = buildAutomationFastChangePreflight_(automation, config);

  if (fastPreflight.mode === 'Fast Skip') {
    updateAutomationConfigValue_(automation, 'LAST_FAST_CHECK_AT', automationNowIso_());
    updateAutomationConfigValue_(automation, 'LAST_SYNC_MODE', 'Fast Skip');
    const gc = runAutomationGarbageCollectionIfNeeded_(automation, config);
    return {
      ok: true,
      pollCount: pollCount,
      syncMode: 'Fast Skip',
      message: 'No source changes detected.',
      changeIndexRows: fastPreflight.rowCount,
      garbageCollection: gc,
      durationMs: new Date().getTime() - startedAt
    };
  }

  const materialized = materializeAutomationExportIfValid_(automation, config);

  if (!materialized.ok) {
    updateAutomationConfigValue_(automation, 'LAST_SYNC_MODE', 'Circuit Breaker');
    recordAutomationTriggerLog_(automation, {
      'Work Item Type': 'Automation Export',
      'Flow ID': '',
      'Source Row Key': '',
      'Trigger Candidate': 'Circuit breaker blocked export materialization',
      'Event Key': '',
      'Old State Hash': '',
      'New State Hash': '',
      'Old State Summary': '',
      'New State Summary': materialized.message,
      'Dedupe Key': '',
      'Hub Queue ID': '',
      'Processing Status': 'Skipped - Circuit Breaker',
      'Processed At': automationNowIso_(),
      'Processing Error': materialized.message
    });
    return {
      ok: false,
      pollCount: pollCount,
      message: materialized.message,
      durationMs: new Date().getTime() - startedAt
    };
  }

  const rows = readAutomationExportRows_(automation);
  const result = processAutomationExportRows_(automation, config, rows);
  const gc = runAutomationGarbageCollectionIfNeeded_(automation, config);
  const fullSyncMode = result.errors ? 'Full Error' : 'Full';
  if (!result.errors && fastPreflight.indexHealthy && fastPreflight.hash) {
    updateAutomationConfigValue_(automation, 'LAST_CHANGE_INDEX_HASH', fastPreflight.hash);
    updateAutomationConfigValue_(automation, 'LAST_CHANGE_INDEX_AT', automationNowIso_());
  }
  updateAutomationConfigValue_(automation, 'LAST_SYNC_MODE', fullSyncMode);

  return {
    ok: true,
    pollCount: pollCount,
    syncMode: fullSyncMode,
    fastPreflightReason: fastPreflight.reason,
    changeIndexRows: fastPreflight.rowCount || 0,
    materializedRows: materialized.rowCount,
    processedRows: result.processedRows,
    changedRows: result.changedRows,
    hubDraftsCreated: result.hubDraftsCreated,
    skippedRows: result.skippedRows,
    errors: result.errors,
    garbageCollection: gc,
    durationMs: new Date().getTime() - startedAt
  };
}

function materializeAutomationExport() {
  setupAutomationSheets();
  return materializeAutomationExportIfValid_(SpreadsheetApp.getActive(), getAutomationConfig_());
}

function debugValidateAutomationExport() {
  setupAutomationSheets();
  const validation = validateAutomationExportSource_(SpreadsheetApp.getActive(), getAutomationConfig_());
  return JSON.stringify(validation, null, 2);
}

function enableAutomationSandboxDraftCreation() {
  setupAutomationSheets();
  const ss = SpreadsheetApp.getActive();
  updateAutomationConfigValue_(ss, 'CREATE_HUB_DRAFTS', 'TRUE');
  updateAutomationConfigValue_(ss, 'DASHBOARD_STABLE_POLLS', '2');
  updateAutomationConfigValue_(ss, 'REQUIRE_PROJECT_PRIMARY_RISK', 'TRUE');
  const result = buildAutomationConfigSummary_(getAutomationConfig_());
  showAutomationUiMessage_('Sandbox draft creation enabled', result);
  return JSON.stringify(result, null, 2);
}

function disableAutomationDraftCreation() {
  setupAutomationSheets();
  const ss = SpreadsheetApp.getActive();
  updateAutomationConfigValue_(ss, 'CREATE_HUB_DRAFTS', 'FALSE');
  const result = buildAutomationConfigSummary_(getAutomationConfig_());
  showAutomationUiMessage_('Dashboard draft creation disabled', result);
  return JSON.stringify(result, null, 2);
}

function showAutomationExportValidation() {
  const validation = JSON.parse(debugValidateAutomationExport());
  showAutomationUiMessage_(validation.ok ? 'Automation export is valid' : 'Automation export validation failed', {
    ok: validation.ok,
    message: validation.message,
    rowCount: validation.rows ? validation.rows.length : 0
  });
  return JSON.stringify(validation, null, 2);
}

function showAutomationSyncResult() {
  const result = syncLeadershipDashboardToAutomation();
  showAutomationUiMessage_(result.ok ? 'Dashboard sync completed' : 'Dashboard sync stopped', result);
  return JSON.stringify(result, null, 2);
}

function resetAutomationShadowEvidenceForDev() {
  setupAutomationSheets();
  const ss = SpreadsheetApp.getActive();
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.EXPORT), AUTOMATION.HEADERS.EXPORT);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS), AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES), AUTOMATION.HEADERS.DASHBOARD_CHANGES);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS), AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG), AUTOMATION.HEADERS.TRIGGER_LOG);
  updateAutomationConfigValue_(ss, 'POLL_COUNT', '0');
  updateAutomationConfigValue_(ss, 'LAST_GC_AT', '');
  updateAutomationConfigValue_(ss, 'LAST_CHANGE_INDEX_HASH', '');
  updateAutomationConfigValue_(ss, 'LAST_CHANGE_INDEX_AT', '');
  updateAutomationConfigValue_(ss, 'LAST_FAST_CHECK_AT', '');
  updateAutomationConfigValue_(ss, 'LAST_SYNC_MODE', '');
  updateAutomationConfigValue_(ss, 'CREATE_HUB_DRAFTS', 'FALSE');
  return {
    ok: true,
    message: 'Automation shadow evidence reset. CREATE_HUB_DRAFTS is FALSE.'
  };
}

function buildAutomationConfigSummary_(config) {
  return {
    CREATE_HUB_DRAFTS: String(config.CREATE_HUB_DRAFTS || ''),
    DASHBOARD_STABLE_POLLS: String(config.DASHBOARD_STABLE_POLLS || ''),
    REQUIRE_PROJECT_PRIMARY_RISK: String(config.REQUIRE_PROJECT_PRIMARY_RISK || ''),
    FAST_CHANGE_INDEX_ENABLED: String(config.FAST_CHANGE_INDEX_ENABLED || ''),
    LAST_SYNC_MODE: String(config.LAST_SYNC_MODE || ''),
    HUB_SPREADSHEET_ID_CONFIGURED: config.HUB_SPREADSHEET_ID ? 'TRUE' : 'FALSE'
  };
}

function showAutomationUiMessage_(title, details) {
  const text = Object.keys(details || {}).map(key => key + ': ' + formatAutomationUiValue_(details[key])).join('\n');
  SpreadsheetApp.getUi().alert(title, text || 'Done.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function formatAutomationUiValue_(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ensureAutomationRawSheet_(ss, name) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1).setValue('Formula-owned raw import area.');
  }
  return sheet;
}

function ensureAutomationSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setNumberFormat('@').setValues([headers]);
    return sheet;
  }

  enforceAutomationHeaders_(sheet, headers);
  return sheet;
}

function ensureAutomationChangeIndexSheet_(ss) {
  const sheet = ensureAutomationSheet_(ss, AUTOMATION.SHEETS.CHANGE_INDEX, AUTOMATION.HEADERS.CHANGE_INDEX);
  installAutomationChangeIndexFormulaIfNeeded_(sheet);
  sheet.hideSheet();
  return sheet;
}

function installAutomationChangeIndexFormulaIfNeeded_(sheet) {
  const formula = buildAutomationChangeIndexFormula_();
  if (sheet.getRange(2, 1).getFormula() === formula) return;

  if (sheet.getMaxRows() < 2) sheet.insertRowAfter(1);
  sheet
    .getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), AUTOMATION.HEADERS.CHANGE_INDEX.length)
    .clearContent();
  sheet.getRange(2, 1).setFormula(formula);
  SpreadsheetApp.flush();
}

function buildAutomationChangeIndexFormula_() {
  const source = "'" + AUTOMATION.SHEETS.EXPORT_SOURCE.replace(/'/g, "''") + "'";
  const range = letter => source + '!' + letter + '2:' + letter;
  const text = letter => letter === 'Z' ? 'IFERROR(TO_TEXT(' + range(letter) + '),"")' : 'TO_TEXT(' + range(letter) + ')';
  const signature = (prefix, letters) => '"' + prefix + '|"&' + letters.map(text).join('&CHAR(31)&');
  const sourceSignature = signature('source', [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'Z'
  ]);
  const signalSignature = signature('signal', ['F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'T', 'Z']);

  return '=ARRAYFORMULA(IF(LEN(' + range('B') + ')=0,,{' +
    [
      text('B'),
      text('C'),
      text('A'),
      text('Y'),
      'ROW(' + range('B') + ')',
      sourceSignature,
      signalSignature
    ].join(',') +
    '}))';
}

function enforceAutomationHeaders_(sheet, headers) {
  const currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0];
  const existing = current.filter(value => value !== '');
  const merged = headers.slice();

  existing.forEach(header => {
    if (merged.indexOf(header) < 0) merged.push(header);
  });

  const alreadyCurrent = merged.every((header, index) => String(current[index] || '') === String(header)) &&
    current.slice(merged.length).every(value => value === '');
  if (alreadyCurrent) return;

  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
}

function resetAutomationSheet_(sheet, headers) {
  sheet.clearContents();
  formatAutomationSheetAsText_(sheet, headers.length, 1);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function formatAutomationSheetAsText_(sheet, columnCount, rowCount) {
  if (!sheet || !columnCount) return;
  sheet.getRange(1, 1, Math.max(Number(rowCount || 1), 1), columnCount).setNumberFormat('@');
}

function seedAutomationConfig_(sheet) {
  const values = sheet.getDataRange().getValues();
  const existingKeys = values.slice(1).map(row => String(row[0]));
  const hadV2Config = existingKeys.indexOf('POLL_COUNT') >= 0;

  AUTOMATION.CONFIG_ROWS.slice().reverse().forEach(row => {
    if (existingKeys.indexOf(row[0]) >= 0) return;
    insertAutomationValuesAtTop_(sheet, row);
  });

  if (!hadV2Config) {
    updateAutomationConfigValue_(SpreadsheetApp.getActive(), 'CREATE_HUB_DRAFTS', 'FALSE');
  }
}

function materializeAutomationExportIfValid_(automation, config) {
  const validation = validateAutomationExportSource_(automation, config);
  if (!validation.ok) return validation;

  const exportHeaders = validation.headers || AUTOMATION.HEADERS.EXPORT;
  const exportSheet = automation.getSheetByName(AUTOMATION.SHEETS.EXPORT);
  exportSheet.clearContents();
  exportSheet
    .getRange(1, 1, Math.max(validation.rows.length + 1, 1), exportHeaders.length)
    .setNumberFormat('@');
  exportSheet.getRange(1, 1, 1, exportHeaders.length).setValues([exportHeaders]);

  if (validation.rows.length) {
    exportSheet
      .getRange(2, 1, validation.rows.length, exportHeaders.length)
      .setValues(validation.rows.map(row => exportHeaders.map(header => row[header] == null ? '' : row[header])));
  }

  return {
    ok: true,
    message: 'Automation_Export materialized.',
    rowCount: validation.rows.length
  };
}

function validateAutomationExportSource_(automation, config) {
  const source = automation.getSheetByName(AUTOMATION.SHEETS.EXPORT_SOURCE);
  if (!source) {
    return { ok: false, message: 'Missing Automation_Export_Source sheet.', rows: [] };
  }

  const headerValidation = validateAutomationExportHeaders_(source);
  if (!headerValidation.ok) return headerValidation;

  const errorScan = scanAutomationExportErrors_(source, Number(config.EXPORT_ERROR_SCAN_ROWS || 5), headerValidation.headers.length);
  if (!errorScan.ok) return errorScan;

  const rows = getAutomationObjectsByHeaders_(source, headerValidation.headers)
    .filter(row => Object.keys(row).some(key => row[key] !== ''))
    .map(normalizeAutomationExportRow_)
    .filter(isAutomationExportRowActive_);

  const identityValidation = validateAutomationExportIdentity_(rows);
  if (!identityValidation.ok) return identityValidation;

  const minRows = Number(config.MIN_ACTIVE_EXPORT_ROWS || 1);
  if (rows.length < minRows) {
    return {
      ok: false,
      message: 'Automation_Export_Source has ' + rows.length + ' active rows; minimum is ' + minRows + '.',
      rows: []
    };
  }

  return {
    ok: true,
    message: 'Automation_Export_Source passed validation.',
    rows: rows,
    headers: headerValidation.headers
  };
}

function validateAutomationExportHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), AUTOMATION.HEADERS.EXPORT.length);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const nonEmptyHeaders = headers.filter(value => String(value || '').trim() !== '');
  const optionalHeaders = getAutomationOptionalExportHeaders_();

  if (nonEmptyHeaders.length < AUTOMATION.HEADERS.EXPORT.length) {
    return {
      ok: false,
      message: 'Automation_Export_Source header count mismatch. Expected at least ' +
        AUTOMATION.HEADERS.EXPORT.length + ', found ' + nonEmptyHeaders.length + '.',
      rows: []
    };
  }

  for (let i = 0; i < AUTOMATION.HEADERS.EXPORT.length; i++) {
    if (String(headers[i] || '').trim() !== AUTOMATION.HEADERS.EXPORT[i]) {
      return {
        ok: false,
        message: 'Automation_Export_Source header mismatch at column ' + (i + 1) +
          '. Expected "' + AUTOMATION.HEADERS.EXPORT[i] + '", found "' + headers[i] + '".',
        rows: []
      };
    }
  }

  for (let i = AUTOMATION.HEADERS.EXPORT.length; i < nonEmptyHeaders.length; i++) {
    if (optionalHeaders.indexOf(String(nonEmptyHeaders[i] || '').trim()) < 0) {
      return {
        ok: false,
        message: 'Automation_Export_Source has unsupported optional header "' + nonEmptyHeaders[i] +
          '" at column ' + (i + 1) + '.',
        rows: []
      };
    }
  }

  return { ok: true, message: 'Headers valid.', rows: [], headers: nonEmptyHeaders };
}

function scanAutomationExportErrors_(sheet, scanRows, columnCount) {
  const rowsToScan = Math.min(Math.max(Number(scanRows || 5), 1) + 1, Math.max(sheet.getLastRow(), 1));
  const values = sheet.getRange(1, 1, rowsToScan, columnCount || AUTOMATION.HEADERS.EXPORT.length).getDisplayValues();
  const tokens = ['#REF!', '#N/A', '#VALUE!', '#NULL!', '#LOADING!'];

  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const value = String(values[r][c] || '').toUpperCase();
      for (let t = 0; t < tokens.length; t++) {
        if (value.indexOf(tokens[t]) >= 0) {
          return {
            ok: false,
            message: 'Automation_Export_Source contains ' + tokens[t] +
              ' at row ' + (r + 1) + ', column ' + (c + 1) + '.',
            rows: []
          };
        }
      }
    }
  }

  return { ok: true, message: 'No formula error tokens found.', rows: [] };
}

function validateAutomationExportIdentity_(rows) {
  const seen = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const recordType = normalizeAutomationRecordType_(row['Record Type']);
    const sourceItemId = String(row['Source Item ID'] || '').trim();
    const flowId = String(row['Flow ID'] || '').trim();

    if (recordType !== 'Project' && recordType !== 'Release') {
      return { ok: false, message: 'Invalid Record Type at active export row ' + (i + 2) + ': ' + row['Record Type'], rows: [] };
    }
    if (!sourceItemId) {
      return { ok: false, message: 'Missing Source Item ID at active export row ' + (i + 2) + '.', rows: [] };
    }
    if (!flowId) {
      return { ok: false, message: 'Missing Flow ID at active export row ' + (i + 2) + '.', rows: [] };
    }
    if (recordType === 'Project' && !/^prj-[a-z0-9-]+$/.test(flowId)) {
      return { ok: false, message: 'Project Flow ID must match prj-* at active export row ' + (i + 2) + ': ' + flowId, rows: [] };
    }
    if (recordType === 'Release' && !/^rel-[a-z0-9-]+$/.test(flowId)) {
      return { ok: false, message: 'Release Flow ID must match rel-* at active export row ' + (i + 2) + ': ' + flowId, rows: [] };
    }
    if (seen[sourceItemId]) {
      return { ok: false, message: 'Duplicate Source Item ID in Automation_Export_Source: ' + sourceItemId, rows: [] };
    }
    seen[sourceItemId] = true;
  }

  return { ok: true, message: 'Export identity valid.', rows: rows };
}

function readAutomationExportRows_(automation) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.EXPORT);
  if (!sheet) return [];
  return getAutomationObjectsByHeaders_(sheet, getAutomationEffectiveExportHeaders_(sheet))
    .filter(row => Object.keys(row).some(key => row[key] !== ''))
    .map(normalizeAutomationExportRow_)
    .filter(isAutomationExportRowActive_);
}

function getAutomationEffectiveExportHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return AUTOMATION.HEADERS.EXPORT;
  const headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), AUTOMATION.HEADERS.EXPORT.length))
    .getDisplayValues()[0]
    .filter(value => String(value || '').trim() !== '')
    .map(value => String(value || '').trim());
  if (headers.length < AUTOMATION.HEADERS.EXPORT.length) return AUTOMATION.HEADERS.EXPORT;
  return headers;
}

function getAutomationOptionalExportHeaders_() {
  return AUTOMATION.OPTIONAL_EXPORT_HEADERS || [];
}

function getAutomationDateExportHeaders_() {
  return AUTOMATION.DATE_EXPORT_HEADERS || [];
}

function normalizeAutomationExportRow_(row) {
  const normalized = Object.assign({}, row);
  getAutomationDateExportHeaders_().forEach(header => {
    if (Object.prototype.hasOwnProperty.call(normalized, header)) {
      normalized[header] = normalizeAutomationDateValue_(normalized[header]);
    }
  });
  return normalized;
}

function normalizeAutomationDateValue_(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  if (!text) return '';
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) return normalizeAutomationParsedDateString_(text);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) return normalizeAutomationParsedDateString_(text);
  if (/^\d{5,6}(\.0+)?$/.test(text)) {
    const serialDate = parseGoogleSheetsSerialDate_(Number(text));
    if (serialDate) return Utilities.formatDate(serialDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return text;
}

function normalizeAutomationParsedDateString_(text) {
  const parsed = parseAutomationDate_(text);
  if (!parsed) return text;
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function parseGoogleSheetsSerialDate_(serial) {
  if (!isFinite(serial) || serial <= 0) return null;
  const millis = Math.round((serial - 25569) * 24 * 60 * 60 * 1000);
  const date = new Date(millis);
  return isNaN(date.getTime()) ? null : date;
}

function processAutomationExportRows_(automation, config, rows) {
  const result = {
    processedRows: 0,
    changedRows: 0,
    hubDraftsCreated: 0,
    skippedRows: 0,
    errors: 0
  };
  const context = createAutomationProcessingContext_(automation);

  rows.forEach(row => {
    result.processedRows++;
    const processed = processAutomationExportRow_(automation, config, row, context);
    if (processed.changed) result.changedRows++;
    if (processed.hubDraftCreated) result.hubDraftsCreated++;
    if (processed.skipped) result.skippedRows++;
    if (processed.error) result.errors++;
  });

  flushAutomationProcessingContext_(automation, context);

  return result;
}

function createAutomationProcessingContext_(automation) {
  const observationRows = readDashboardObservationRows_(automation);
  return {
    now: automationNowIso_(),
    hasExistingObservations: observationRows.length > 0,
    observationsBySourceItemId: buildDashboardObservationMap_(observationRows),
    snapshots: [],
    changes: [],
    triggerLogs: []
  };
}

function flushAutomationProcessingContext_(automation, context) {
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS),
    AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS,
    context.snapshots
  );
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES),
    AUTOMATION.HEADERS.DASHBOARD_CHANGES,
    context.changes
  );
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG),
    AUTOMATION.HEADERS.TRIGGER_LOG,
    context.triggerLogs
  );
  rewriteAutomationObjects_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS),
    AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS,
    Object.keys(context.observationsBySourceItemId).map(key => context.observationsBySourceItemId[key])
  );
}

function readDashboardObservationRows_(automation) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return getAutomationObjectsByHeaders_(sheet, AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS)
    .filter(row => Object.keys(row).some(key => row[key] !== ''));
}

function buildDashboardObservationMap_(rows) {
  return rows.reduce((obj, row) => {
    const sourceItemId = String(row['Source Item ID'] || '').trim();
    if (sourceItemId) obj[sourceItemId] = row;
    return obj;
  }, {});
}

function buildDashboardObservationRow_(row, stateHash, stateJson, options) {
  const opts = options || {};
  return clearPendingDashboardEvaluation_({
    'Source Item ID': row['Source Item ID'] || '',
    'Flow ID': row['Flow ID'] || '',
    'Record Type': normalizeAutomationRecordType_(row['Record Type']),
    Subject: row.Subject || '',
    'State Hash': stateHash || '',
    'State JSON': stateJson || '',
    'Last Observed At': opts.lastObservedAt || '',
    'Last Processed At': opts.lastProcessedAt || '',
    'Last Trigger Log ID': opts.lastTriggerLogId || '',
    'Processing Status': opts.processingStatus || '',
    'Processing Error': opts.processingError || ''
  });
}

function shouldUsePendingDashboardEvaluation_(recordType, changes, trigger) {
  if (trigger && trigger.eventKey) return true;
  if (recordType !== 'Project') return false;

  const signalFields = {
    Status: true,
    Phase: true,
    'Next Gate': true,
    'Next Gate ETA': true,
    'Primary Target': true
  };
  return changes.some(change => signalFields[change.field]);
}

function buildPendingDashboardEvaluation_(observation, row, stateHash, stateJson, trigger, now) {
  const samePendingHash = observation && String(observation['Pending State Hash'] || '') === String(stateHash);
  return {
    stateHash: stateHash,
    stateJson: stateJson,
    since: samePendingHash ? observation['Pending Since'] || now : now,
    lastSeenAt: now,
    stablePolls: samePendingHash ? Number(observation['Pending Stable Polls'] || 0) + 1 : 1,
    triggerCandidate: trigger.candidate || 'Potential multi-field project signal',
    eventKey: trigger.eventKey || ''
  };
}

function applyPendingDashboardEvaluation_(observation, row, pending, triggerId, processingStatus, now, processingError) {
  const base = observation || buildDashboardObservationRow_(row, '', '{}', {});
  return Object.assign(base, {
    'Source Item ID': row['Source Item ID'] || base['Source Item ID'] || '',
    'Flow ID': row['Flow ID'] || base['Flow ID'] || '',
    'Record Type': normalizeAutomationRecordType_(row['Record Type'] || base['Record Type']),
    Subject: row.Subject || base.Subject || '',
    'Last Observed At': now,
    'Last Trigger Log ID': triggerId || base['Last Trigger Log ID'] || '',
    'Processing Status': processingStatus || 'Pending Evaluation',
    'Processing Error': processingError || '',
    'Pending State Hash': pending.stateHash || '',
    'Pending State JSON': pending.stateJson || '',
    'Pending Since': pending.since || now,
    'Pending Last Seen At': pending.lastSeenAt || now,
    'Pending Stable Polls': String(pending.stablePolls || 1),
    'Pending Trigger Candidate': pending.triggerCandidate || '',
    'Pending Event Key': pending.eventKey || ''
  });
}

function clearPendingDashboardEvaluation_(observation) {
  return Object.assign(observation || {}, {
    'Pending State Hash': '',
    'Pending State JSON': '',
    'Pending Since': '',
    'Pending Last Seen At': '',
    'Pending Stable Polls': '',
    'Pending Trigger Candidate': '',
    'Pending Event Key': ''
  });
}

function hasPendingDashboardEvaluation_(observation) {
  return Boolean(observation && observation['Pending State Hash']);
}

function getDashboardStablePolls_(config) {
  return Math.max(1, Number(config.DASHBOARD_STABLE_POLLS || 2));
}

function buildAutomationFastChangePreflight_(automation, config) {
  if (String(config.FAST_CHANGE_INDEX_ENABLED || 'TRUE').toUpperCase() === 'FALSE') {
    return {
      mode: 'Full',
      reason: 'Fast change index disabled.',
      indexHealthy: false,
      rowCount: 0
    };
  }

  const observationRows = readDashboardObservationRows_(automation);
  const hasPendingEvaluation = observationRows.some(hasPendingDashboardEvaluation_);
  const index = readAutomationChangeIndex_(automation);
  if (!index.ok) {
    return {
      mode: 'Full',
      reason: index.message,
      indexHealthy: false,
      rowCount: index.rowCount || 0,
      hasPendingEvaluation: hasPendingEvaluation
    };
  }

  if (hasPendingEvaluation) {
    return {
      mode: 'Full',
      reason: 'Pending dashboard evaluation exists.',
      indexHealthy: true,
      hash: index.hash,
      rowCount: index.rowCount,
      hasPendingEvaluation: true
    };
  }

  if (!observationRows.length) {
    return {
      mode: 'Full',
      reason: 'No dashboard observation baseline exists.',
      indexHealthy: true,
      hash: index.hash,
      rowCount: index.rowCount,
      hasPendingEvaluation: false
    };
  }

  const lastHash = String(config.LAST_CHANGE_INDEX_HASH || '').trim();
  if (lastHash && lastHash === index.hash) {
    return {
      mode: 'Fast Skip',
      reason: 'No source changes detected.',
      indexHealthy: true,
      hash: index.hash,
      rowCount: index.rowCount,
      hasPendingEvaluation: false
    };
  }

  return {
    mode: 'Full',
    reason: lastHash ? 'Change index changed.' : 'No prior change index hash.',
    indexHealthy: true,
    hash: index.hash,
    rowCount: index.rowCount,
    hasPendingEvaluation: false
  };
}

function readAutomationChangeIndex_(automation) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.CHANGE_INDEX);
  if (!sheet) {
    return { ok: false, message: 'Missing Automation_Change_Index sheet.', rowCount: 0 };
  }

  const headerValidation = validateAutomationChangeIndexHeaders_(sheet);
  if (!headerValidation.ok) return headerValidation;

  if (!sheet.getRange(2, 1).getFormula()) {
    return { ok: false, message: 'Automation_Change_Index formula is missing.', rowCount: 0 };
  }

  const rows = getAutomationObjectsByHeaders_(sheet, AUTOMATION.HEADERS.CHANGE_INDEX)
    .filter(row => Object.keys(row).some(key => row[key] !== ''));
  const error = findAutomationErrorTokenInObjects_(rows);
  if (error) {
    return { ok: false, message: 'Automation_Change_Index contains ' + error + '.', rowCount: rows.length };
  }

  const activeRows = rows
    .filter(row => String(row['Source Item ID'] || '').trim())
    .filter(row => !isExplicitlyInactive_(row.Active))
    .map(row => ({
      'Source Item ID': String(row['Source Item ID'] || '').trim(),
      'Flow ID': String(row['Flow ID'] || '').trim(),
      'Record Type': normalizeAutomationRecordType_(row['Record Type']),
      Active: String(row.Active || '').trim(),
      'Source Row': String(row['Source Row'] || '').trim(),
      'Source Signature': String(row['Source Signature'] || '').trim(),
      'Signal Signature': String(row['Signal Signature'] || '').trim()
    }));

  if (!activeRows.length) {
    return { ok: false, message: 'Automation_Change_Index has no active rows.', rowCount: 0 };
  }

  const invalid = activeRows.find(row =>
    !row['Source Item ID'] ||
    !row['Flow ID'] ||
    ['Project', 'Release'].indexOf(row['Record Type']) < 0 ||
    !row['Source Signature'] ||
    !row['Signal Signature']
  );
  if (invalid) {
    return {
      ok: false,
      message: 'Automation_Change_Index has an incomplete active row for Source Item ID: ' +
        (invalid['Source Item ID'] || 'blank') + '.',
      rowCount: activeRows.length
    };
  }

  const hashInput = activeRows
    .map(row => AUTOMATION.HEADERS.CHANGE_INDEX.map(header => row[header] || '').join('\u001e'))
    .sort()
    .join('\u001f');

  return {
    ok: true,
    message: 'Automation_Change_Index is healthy.',
    rowCount: activeRows.length,
    hash: hashString_(hashInput)
  };
}

function validateAutomationChangeIndexHeaders_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, AUTOMATION.HEADERS.CHANGE_INDEX.length)
    .getDisplayValues()[0]
    .map(value => String(value || '').trim());
  for (let i = 0; i < AUTOMATION.HEADERS.CHANGE_INDEX.length; i++) {
    if (headers[i] !== AUTOMATION.HEADERS.CHANGE_INDEX[i]) {
      return {
        ok: false,
        message: 'Automation_Change_Index header mismatch at column ' + (i + 1) +
          '. Expected "' + AUTOMATION.HEADERS.CHANGE_INDEX[i] + '", found "' + headers[i] + '".',
        rowCount: 0
      };
    }
  }
  return { ok: true, message: 'Automation_Change_Index headers valid.', rowCount: 0 };
}

function findAutomationErrorTokenInObjects_(rows) {
  const tokens = ['#REF!', '#N/A', '#VALUE!', '#NULL!', '#LOADING!'];
  for (let r = 0; r < rows.length; r++) {
    const values = Object.keys(rows[r]).map(key => String(rows[r][key] || '').toUpperCase());
    for (let v = 0; v < values.length; v++) {
      for (let t = 0; t < tokens.length; t++) {
        if (values[v].indexOf(tokens[t]) >= 0) return tokens[t];
      }
    }
  }
  return '';
}

function projectSignalNeedsPrimaryRisk_(recordType, trigger, row, config) {
  if (recordType !== 'Project') return false;
  if (String(config.REQUIRE_PROJECT_PRIMARY_RISK || 'TRUE').toUpperCase() !== 'TRUE') return false;
  if (!trigger || trigger.eventKey !== 'project.unexpected_status_change') return false;
  return !String(row['Primary Risk'] || '').trim();
}

function processAutomationExportRow_(automation, config, row, context) {
  const now = context.now || automationNowIso_();
  const sourceItemId = String(row['Source Item ID'] || '').trim();
  const flowId = String(row['Flow ID'] || '').trim();
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  const state = buildAutomationExportState_(row);
  const stateJson = JSON.stringify(state);
  const stateHash = hashString_(stateJson);
  const observation = context.observationsBySourceItemId[sourceItemId] || null;

  context.snapshots.push(buildDashboardSnapshotRow_(row, stateHash, stateJson, now));

  if (!observation && !context.hasExistingObservations) {
    context.observationsBySourceItemId[sourceItemId] = buildDashboardObservationRow_(row, stateHash, stateJson, {
      lastObservedAt: now,
      lastProcessedAt: now,
      lastTriggerLogId: '',
      processingStatus: 'Baseline',
      processingError: ''
    });
    return { changed: false, hubDraftCreated: false, skipped: false, error: false };
  }

  if (observation && String(observation['Flow ID'] || '') !== flowId) {
    const triggerId = queueAutomationTriggerLog_(context, {
      'Work Item Type': recordType,
      'Flow ID': flowId,
      'Source Row Key': sourceItemId,
      'Trigger Candidate': 'Flow ID changed for existing source item',
      'Event Key': '',
      'Old State Hash': observation['State Hash'] || '',
      'New State Hash': stateHash,
      'Old State Summary': summarizeAutomationState_(parseJsonObject_(observation['State JSON'])),
      'New State Summary': summarizeAutomationExportRow_(row),
      'Dedupe Key': '',
      'Hub Queue ID': '',
      'Processing Status': 'Error',
      'Processed At': now,
      'Processing Error': 'Source Item ID ' + sourceItemId + ' changed Flow ID from ' +
        observation['Flow ID'] + ' to ' + flowId + '.'
    });
    context.changes = context.changes.concat(buildDashboardChangeRows_(row, observation, stateHash, [{
      field: 'Flow ID',
      oldValue: observation['Flow ID'] || '',
      newValue: flowId
    }], {
      triggerCandidate: 'Flow ID changed for existing source item',
      eventKey: '',
      dedupeKey: '',
      processingStatus: 'Error',
      processedAt: now,
      processingError: 'Identity mismatch',
      triggerLogId: triggerId
    }));
    return { changed: true, hubDraftCreated: false, skipped: false, error: true };
  }

  if (observation && String(observation['State Hash'] || '') === stateHash) {
    if (hasPendingDashboardEvaluation_(observation)) {
      const triggerId = queueAutomationTriggerLog_(context, {
        'Work Item Type': recordType,
        'Flow ID': flowId,
        'Source Row Key': sourceItemId,
        'Trigger Candidate': observation['Pending Trigger Candidate'] || 'Signal reverted before stable evaluation',
        'Event Key': observation['Pending Event Key'] || '',
        'Old State Hash': observation['State Hash'] || '',
        'New State Hash': stateHash,
        'Old State Summary': summarizeAutomationState_(parseJsonObject_(observation['State JSON'])),
        'New State Summary': summarizeAutomationExportRow_(row),
        'Dedupe Key': '',
        'Hub Queue ID': '',
        'Processing Status': 'Signal Reverted',
        'Processed At': now,
        'Processing Error': ''
      });
      context.observationsBySourceItemId[sourceItemId] = clearPendingDashboardEvaluation_(Object.assign(observation, {
        'Last Observed At': now,
        'Last Processed At': now,
        'Last Trigger Log ID': triggerId,
        'Processing Status': 'Signal Reverted',
        'Processing Error': ''
      }));
      return { changed: true, hubDraftCreated: false, skipped: true, error: false };
    }

    context.observationsBySourceItemId[sourceItemId] = Object.assign(observation, {
      'Last Observed At': now,
      'Processing Status': 'No Change',
      'Processing Error': ''
    });
    return { changed: false, hubDraftCreated: false, skipped: false, error: false };
  }

  const oldState = observation ? parseJsonObject_(observation['State JSON']) : {};
  const changes = diffAutomationStates_(oldState, state);
  const trigger = inferAutomationExportTrigger_(row, oldState, changes);
  const needsPendingEvaluation = shouldUsePendingDashboardEvaluation_(recordType, changes, trigger);

  if (needsPendingEvaluation) {
    const pending = buildPendingDashboardEvaluation_(observation, row, stateHash, stateJson, trigger, now);
    if (pending.stablePolls < getDashboardStablePolls_(config)) {
      const triggerId = queueAutomationTriggerLog_(context, {
        'Work Item Type': recordType,
        'Flow ID': flowId,
        'Source Row Key': sourceItemId,
        'Trigger Candidate': trigger.candidate || 'Potential multi-field project signal',
        'Event Key': trigger.eventKey || '',
        'Old State Hash': observation && observation['State Hash'] || '',
        'New State Hash': stateHash,
        'Old State Summary': summarizeAutomationState_(oldState),
        'New State Summary': summarizeAutomationExportRow_(row),
        'Dedupe Key': '',
        'Hub Queue ID': '',
        'Processing Status': 'Pending Evaluation',
        'Processed At': now,
        'Processing Error': ''
      });
      context.changes = context.changes.concat(buildDashboardChangeRows_(row, observation, stateHash, changes, {
        triggerCandidate: trigger.candidate || 'Potential multi-field project signal',
        eventKey: trigger.eventKey || '',
        dedupeKey: '',
        processingStatus: 'Pending Evaluation',
        processedAt: now,
        processingError: '',
        triggerLogId: triggerId
      }));
      context.observationsBySourceItemId[sourceItemId] = applyPendingDashboardEvaluation_(
        observation,
        row,
        pending,
        triggerId,
        'Pending Evaluation',
        now
      );
      return { changed: true, hubDraftCreated: false, skipped: true, error: false };
    }

    if (projectSignalNeedsPrimaryRisk_(recordType, trigger, row, config)) {
      const triggerId = queueAutomationTriggerLog_(context, {
        'Work Item Type': recordType,
        'Flow ID': flowId,
        'Source Row Key': sourceItemId,
        'Trigger Candidate': trigger.candidate,
        'Event Key': trigger.eventKey,
        'Old State Hash': observation && observation['State Hash'] || '',
        'New State Hash': stateHash,
        'Old State Summary': summarizeAutomationState_(oldState),
        'New State Summary': summarizeAutomationExportRow_(row),
        'Dedupe Key': '',
        'Hub Queue ID': '',
        'Processing Status': 'Needs Reason',
        'Processed At': now,
        'Processing Error': 'Primary Risk is required before creating a project communication draft.'
      });
      context.observationsBySourceItemId[sourceItemId] = applyPendingDashboardEvaluation_(
        observation,
        row,
        pending,
        triggerId,
        'Needs Reason',
        now,
        'Primary Risk is required before creating a project communication draft.'
      );
      return { changed: true, hubDraftCreated: false, skipped: true, error: false };
    }
  }

  const manualReview = isTruthy_(row['Manual Review']);
  const createHubDrafts = String(config.CREATE_HUB_DRAFTS || 'FALSE').toUpperCase() === 'TRUE';
  const dedupeKey = trigger.eventKey ? 'dashboard|' + sourceItemId + '|' + trigger.eventKey + '|' + stateHash : '';
  let hubQueueId = '';
  let processingStatus = '';
  let processingError = '';
  let skipped = false;
  let error = false;

  if (!trigger.eventKey) {
    processingStatus = 'Logged Only';
    skipped = true;
  } else if (manualReview) {
    processingStatus = 'Skipped - Manual Review';
    skipped = true;
  } else if (!createHubDrafts) {
    processingStatus = 'Skipped - Hub Drafts Disabled';
    skipped = true;
  } else {
    try {
      if (!config.HUB_SPREADSHEET_ID) throw new Error('Missing HUB_SPREADSHEET_ID in Automation Config.');
      hubQueueId = insertHubDraftFromAutomationAtTop_(
        config.HUB_SPREADSHEET_ID,
        buildHubDraftFromExportChange_(row, trigger, changes, oldState, stateHash, dedupeKey)
      );
      processingStatus = 'Draft Created';
    } catch (draftError) {
      processingStatus = 'Error';
      processingError = draftError.message || String(draftError);
      error = true;
    }
  }

  const triggerId = queueAutomationTriggerLog_(context, {
    'Work Item Type': recordType,
    'Flow ID': flowId,
    'Source Row Key': sourceItemId,
    'Trigger Candidate': trigger.candidate,
    'Event Key': trigger.eventKey,
    'Old State Hash': observation && observation['State Hash'] || '',
    'New State Hash': stateHash,
    'Old State Summary': summarizeAutomationState_(oldState),
    'New State Summary': summarizeAutomationExportRow_(row),
    'Dedupe Key': dedupeKey,
    'Hub Queue ID': hubQueueId,
    'Processing Status': processingStatus,
    'Processed At': now,
    'Processing Error': processingError
  });

  context.changes = context.changes.concat(buildDashboardChangeRows_(row, observation, stateHash, changes, {
    triggerCandidate: trigger.candidate,
    eventKey: trigger.eventKey,
    dedupeKey: dedupeKey,
    processingStatus: processingStatus,
    processedAt: now,
    processingError: processingError,
    triggerLogId: triggerId
  }));

  if (!error) {
    context.observationsBySourceItemId[sourceItemId] = clearPendingDashboardEvaluation_(
      buildDashboardObservationRow_(row, stateHash, stateJson, {
        lastObservedAt: now,
        lastProcessedAt: now,
        lastTriggerLogId: triggerId,
        processingStatus: processingStatus,
        processingError: ''
      })
    );
  }

  return {
    changed: true,
    hubDraftCreated: Boolean(hubQueueId),
    skipped: skipped,
    error: error
  };
}

function recordDashboardSnapshot_(automation, row, stateHash, stateJson, timestamp) {
  insertByHeadersAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS),
    AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS,
    buildDashboardSnapshotRow_(row, stateHash, stateJson, timestamp)
  );
}

function buildDashboardSnapshotRow_(row, stateHash, stateJson, timestamp) {
  return {
    'Snapshot ID': Utilities.getUuid(),
    'Snapshot At': timestamp,
    'Record Type': normalizeAutomationRecordType_(row['Record Type']),
    'Source Item ID': row['Source Item ID'],
    'Flow ID': row['Flow ID'],
    'State Hash': stateHash,
    'State JSON': stateJson
  };
}

function recordDashboardChangeRows_(automation, row, observation, newStateHash, changes, context) {
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES),
    AUTOMATION.HEADERS.DASHBOARD_CHANGES,
    buildDashboardChangeRows_(row, observation, newStateHash, changes, context)
  );
}

function buildDashboardChangeRows_(row, observation, newStateHash, changes, context) {
  const oldStateHash = observation && observation['State Hash'] || '';
  const now = context.processedAt || automationNowIso_();

  return changes.map(change => {
    return {
      'Change ID': Utilities.getUuid(),
      'Detected At': now,
      'Record Type': normalizeAutomationRecordType_(row['Record Type']),
      'Source Item ID': row['Source Item ID'],
      'Flow ID': row['Flow ID'],
      Field: change.field,
      'Old Value': change.oldValue,
      'New Value': change.newValue,
      'Old State Hash': oldStateHash,
      'New State Hash': newStateHash,
      'Trigger Candidate': context.triggerCandidate || '',
      'Event Key': context.eventKey || '',
      'Dedupe Key': context.dedupeKey || '',
      'Processing Status': context.processingStatus || '',
      'Processed At': now,
      'Processing Error': context.processingError || ''
    };
  });
}

function recordAutomationTriggerLog_(automation, fields) {
  const row = buildAutomationTriggerLogRow_(fields);
  insertByHeadersAtTop_(automation.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG), AUTOMATION.HEADERS.TRIGGER_LOG, row);
  return row['Trigger Log ID'];
}

function queueAutomationTriggerLog_(context, fields) {
  const row = buildAutomationTriggerLogRow_(fields, context.now);
  context.triggerLogs.push(row);
  return row['Trigger Log ID'];
}

function buildAutomationTriggerLogRow_(fields, timestamp) {
  return Object.assign({
    'Trigger Log ID': Utilities.getUuid(),
    'Created At': timestamp || automationNowIso_()
  }, fields);
}

function buildAutomationExportState_(row) {
  const ignored = {
    'Updated At': true,
    Active: true,
    'Manual Review': true,
    'Channel Override': true,
    'Slack Thread ID': true
  };

  return getAutomationStateHeadersForRow_(row).reduce((obj, header) => {
    if (ignored[header]) return obj;
    obj[header] = stringifyAutomationValue_(row[header]);
    return obj;
  }, {});
}

function getAutomationStateHeadersForRow_(row) {
  const headers = AUTOMATION.HEADERS.EXPORT.slice();
  getAutomationOptionalExportHeaders_().forEach(header => {
    if (Object.prototype.hasOwnProperty.call(row, header)) headers.push(header);
  });
  return headers;
}

function diffAutomationStates_(oldState, newState) {
  const keys = {};
  Object.keys(oldState || {}).forEach(key => { keys[key] = true; });
  Object.keys(newState || {}).forEach(key => { keys[key] = true; });

  return Object.keys(keys).sort().filter(key =>
    stringifyAutomationValue_(oldState[key]) !== stringifyAutomationValue_(newState[key])
  ).map(key => ({
    field: key,
    oldValue: stringifyAutomationValue_(oldState[key]),
    newValue: stringifyAutomationValue_(newState[key])
  }));
}

function inferAutomationExportTrigger_(row, oldState, changes) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  if (!changes.length) return { candidate: '', eventKey: '' };

  if (recordType === 'Project') {
    return inferProjectExportTrigger_(row, oldState, changes);
  }

  if (recordType === 'Release') {
    return inferReleaseExportTrigger_(row, oldState, changes);
  }

  return { candidate: 'Changed', eventKey: '' };
}

function inferProjectExportTrigger_(row, oldState, changes) {
  const fields = changes.map(change => change.field);
  const status = normalizeStatus_(row.Status);
  const oldStatus = normalizeStatus_(oldState.Status);

  if (isProjectGateCleared_(row, oldState, fields)) {
    if (isProjectPrimaryTargetCleared_(row, oldState)) {
      return { candidate: 'Project primary target cleared', eventKey: 'project.completed' };
    }
    return { candidate: 'Project gate cleared', eventKey: 'project.gate_passed' };
  }

  if (isProjectStatusCommunication_(oldStatus, status, fields)) {
    return {
      candidate: status === 'GREEN' ? 'Project back on track' : 'Material project status change',
      eventKey: 'project.unexpected_status_change'
    };
  }

  if (fields.indexOf('Next Gate ETA') >= 0) {
    return { candidate: 'Project next gate ETA changed', eventKey: 'project.unexpected_status_change' };
  }

  if (fields.indexOf('Primary Target') >= 0) {
    return { candidate: 'Project primary target changed', eventKey: 'project.unexpected_status_change' };
  }

  return { candidate: 'Project changed', eventKey: '' };
}

function isProjectStatusCommunication_(oldStatus, newStatus, fields) {
  if (fields.indexOf('Status') < 0 || oldStatus === newStatus) return false;
  if (['YELLOW', 'RED'].indexOf(newStatus) >= 0) return true;
  return newStatus === 'GREEN' && ['YELLOW', 'RED'].indexOf(oldStatus) >= 0;
}

function isProjectGateCleared_(row, oldState, fields) {
  if (fields.indexOf('Phase') < 0 || fields.indexOf('Next Gate') < 0 || fields.indexOf('Next Gate ETA') < 0) {
    return false;
  }

  const oldEta = parseAutomationDate_(oldState['Next Gate ETA']);
  const newEta = parseAutomationDate_(row['Next Gate ETA']);
  if (!oldEta || !newEta || newEta.getTime() <= oldEta.getTime()) return false;

  return stringifyAutomationValue_(oldState.Phase) !== stringifyAutomationValue_(row.Phase) &&
    stringifyAutomationValue_(oldState['Next Gate']) !== stringifyAutomationValue_(row['Next Gate']);
}

function isProjectPrimaryTargetCleared_(row, oldState) {
  const primaryTarget = stringifyAutomationValue_(row['Primary Target'] || oldState['Primary Target']);
  if (!primaryTarget) return false;

  const oldGate = stringifyAutomationValue_(oldState['Next Gate']);
  const oldPhase = stringifyAutomationValue_(oldState.Phase);
  return automationTextMatches_(oldGate, primaryTarget) || automationTextMatches_(oldPhase, primaryTarget);
}

function inferReleaseExportTrigger_(row, oldState, changes) {
  const fields = changes.map(change => change.field);
  const rollbackStatus = String(row['Rollback Status'] || '').trim().toLowerCase();
  const goNoGo = String(row['Go / No-Go Required'] || '').trim().toLowerCase();
  const releaseStatus = String(row['Release Status'] || row.Status || row.Phase || '').trim();

  if (fields.indexOf('Rollback Status') >= 0 && rollbackStatus && rollbackStatus !== 'none' && rollbackStatus !== 'no') {
    return { candidate: 'Release rollback state changed', eventKey: 'release.rolled_back' };
  }

  if (fields.indexOf('Go / No-Go Required') >= 0 && ['yes', 'true', 'required'].indexOf(goNoGo) >= 0) {
    return { candidate: 'Release go / no-go required', eventKey: 'release.go_no_go' };
  }

  if (fields.indexOf('Release Status') >= 0 || fields.indexOf('Status') >= 0 || fields.indexOf('Phase') >= 0) {
    const eventKey = inferReleaseEventKey_(releaseStatus, row.Notes);
    if (eventKey) return { candidate: 'Release lifecycle state changed', eventKey: eventKey };
  }

  if (fields.indexOf('Release Date') >= 0 && row['Release Date']) {
    return { candidate: 'Release schedule changed', eventKey: 'release.scheduled' };
  }

  return { candidate: 'Release changed', eventKey: '' };
}

function buildHubDraftFromExportChange_(row, trigger, changes, oldState, stateHash, dedupeKey) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  const owner = row.Owner || 'TPM';
  const payload = buildAutomationPayloadFromExport_(row, trigger, changes, oldState, owner);

  return {
    'Queue ID': Utilities.getUuid(),
    'Flow ID': row['Flow ID'],
    'Dedupe Key': dedupeKey || ('dashboard|' + row['Source Item ID'] + '|' + trigger.eventKey + '|' + stateHash),
    'Created At': automationNowIso_(),
    'Updated At': automationNowIso_(),
    Source: 'Automation Dashboard',
    Lane: recordType === 'Release' ? 'Production Release' : 'Project',
    'Event Key': trigger.eventKey,
    Status: 'Draft',
    Priority: inferAutomationPriority_(trigger.eventKey, row),
    Owner: owner,
    'Channel Override': row['Channel Override'] || '',
    'Slack Thread ID': row['Slack Thread ID'] || '',
    'Payload JSON': JSON.stringify(payload)
  };
}

function buildAutomationPayloadFromExport_(row, trigger, changes, oldState, owner) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  const subject = row.Subject || row['Source Item ID'];
  const payload = {
    subject: subject,
    owner: owner,
    project: subject,
    event_key: trigger.eventKey,
    source_item_id: row['Source Item ID'],
    what: buildAutomationWhat_(recordType, row, trigger, changes, oldState),
    so_what: inferAutomationSoWhat_(recordType, trigger.eventKey, trigger),
    whats_next: inferAutomationWhatsNext_(recordType, trigger.eventKey, trigger),
    status: row.Status || '',
    phase: row.Phase || '',
    gate: row['Next Gate'] || '',
    next_gate: row['Next Gate'] || '',
    next_gate_eta: row['Next Gate ETA'] || '',
    risk_level: row['Risk Level'] || '',
    confidence: row.Confidence || '',
    primary_risk: row['Primary Risk'] || '',
    primary_target: row['Primary Target'] || '',
    notes: row.Notes || ''
  };

  if (recordType === 'Release') {
    payload.release_id = row['Source Item ID'];
    payload.release_name = subject;
    payload.release_date = row['Release Date'];
    payload.release_status = row['Release Status'] || row.Status || row.Phase || '';
    payload.included_projects = row['Included Projects'];
    payload.known_issues = row['Known Issues'];
    payload.decision_owner = owner;
    payload.rollback_status = row['Rollback Status'];
    payload.go_no_go_required = row['Go / No-Go Required'];
  }

  return payload;
}

function buildAutomationWhat_(recordType, row, trigger, changes, oldState) {
  if (recordType === 'Project') {
    return buildProjectChangeSummary_(row, oldState || {}, changes, trigger);
  }
  return buildChangeSummary_(changes);
}

function buildProjectChangeSummary_(row, oldState, changes, trigger) {
  const candidate = String(trigger.candidate || '');
  const reason = row['Primary Risk'] || oldState['Primary Risk'] || 'No primary risk is listed yet.';

  if (candidate === 'Project primary target cleared') {
    return 'Primary target cleared: ' + (row['Primary Target'] || oldState['Primary Target'] || 'target') +
      '. Current phase moved from "' + (oldState.Phase || 'blank') + '" to "' + (row.Phase || 'blank') +
      '"; next gate is "' + (row['Next Gate'] || 'blank') + '" with ETA "' + (row['Next Gate ETA'] || 'blank') + '".';
  }

  if (candidate === 'Project gate cleared') {
    return 'Gate cleared: "' + (oldState['Next Gate'] || 'previous gate') + '". Current phase moved from "' +
      (oldState.Phase || 'blank') + '" to "' + (row.Phase || 'blank') + '"; next gate is "' +
      (row['Next Gate'] || 'blank') + '" with ETA "' + (row['Next Gate ETA'] || 'blank') + '".';
  }

  if (candidate === 'Project back on track') {
    return 'Status moved back to green from "' + (oldState.Status || 'blank') +
      '". Reason / context: ' + reason;
  }

  if (candidate === 'Material project status change') {
    return 'Status changed from "' + (oldState.Status || 'blank') + '" to "' + (row.Status || 'blank') +
      '". Primary risk / reason: ' + reason;
  }

  if (candidate === 'Project next gate ETA changed') {
    return 'Next gate timing changed for "' + (row['Next Gate'] || oldState['Next Gate'] || 'the next gate') +
      '": ETA moved from "' + (oldState['Next Gate ETA'] || 'blank') + '" to "' +
      (row['Next Gate ETA'] || 'blank') + '". Reason / context: ' + reason;
  }

  if (candidate === 'Project primary target changed') {
    return 'Primary target changed from "' + (oldState['Primary Target'] || 'blank') + '" to "' +
      (row['Primary Target'] || 'blank') + '". Reason / context: ' + reason;
  }

  return buildChangeSummary_(changes);
}

function buildChangeSummary_(changes) {
  if (!changes.length) return 'Dashboard state changed.';
  return changes.slice(0, 5).map(change =>
    change.field + ' changed from "' + (change.oldValue || 'blank') + '" to "' + (change.newValue || 'blank') + '".'
  ).join(' ');
}

function summarizeAutomationExportRow_(row) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  if (recordType === 'Release') {
    return [
      row.Subject || row['Source Item ID'],
      row['Release Date'] || '',
      row['Release Status'] || row.Status || row.Phase || ''
    ].filter(Boolean).join(' | ');
  }
  return [
    row.Subject || row['Source Item ID'],
    row.Status || '',
    row.Phase || '',
    row['Risk Level'] || row['Primary Risk'] || ''
  ].filter(Boolean).join(' | ');
}

function summarizeAutomationState_(state) {
  if (!state) return '';
  return [
    state.Subject || state['Source Item ID'] || '',
    state.Status || state['Release Status'] || '',
    state.Phase || '',
    state['Risk Level'] || state['Primary Risk'] || ''
  ].filter(Boolean).join(' | ');
}

function inferAutomationSoWhat_(recordType, eventKey, trigger) {
  if (recordType === 'Release') {
    if (eventKey === 'release.rolled_back') return 'Stakeholders need a clear production state and recovery expectation.';
    if (eventKey === 'release.delayed') return 'Stakeholders need to adjust release expectations, support readiness, and timing.';
    return 'This release update may affect production timing, support readiness, monitoring, or stakeholder expectations.';
  }

  const candidate = trigger && trigger.candidate || '';
  if (candidate === 'Project primary target cleared') {
    return 'Stakeholders should know the project reached its primary target; any further rollout work can be tracked separately.';
  }
  if (candidate === 'Project gate cleared') {
    return 'Stakeholders should know the project advanced and expectations have shifted to the next gate.';
  }
  if (candidate === 'Project back on track') {
    return 'Stakeholders should know the project is back on track and the prior risk has been reduced.';
  }
  if (candidate === 'Project next gate ETA changed' || candidate === 'Project primary target changed') {
    return 'Stakeholders need updated timing or target expectations for planning and dependency management.';
  }

  return 'This may affect project expectations, risk, timeline, release, or stakeholder confidence.';
}

function inferAutomationWhatsNext_(recordType, eventKey, trigger) {
  if (recordType === 'Release') {
    if (eventKey === 'release.go_no_go') return 'Release owner should confirm readiness and the go / no-go decision.';
    if (eventKey === 'release.rolled_back') return 'Release owner should confirm recovery status and whether a postmortem is needed.';
    return 'Release owner should review readiness, confirm impact, and approve or discard this draft.';
  }

  const candidate = trigger && trigger.candidate || '';
  if (candidate === 'Project primary target cleared') {
    return 'Lead PM should confirm whether the project can be marked complete or whether additional rollout phases remain.';
  }
  if (candidate === 'Project gate cleared') {
    return 'Lead PM should confirm the next gate, ETA, and any readiness needs before approving this update.';
  }
  if (candidate === 'Project back on track') {
    return 'Lead PM should confirm the risk is resolved or contained and approve the back-on-track update.';
  }
  if (candidate === 'Project next gate ETA changed' || candidate === 'Project primary target changed') {
    return 'Lead PM should confirm the reason, updated timing, and stakeholder impact before approving this update.';
  }

  return 'Lead PM or TPM should review the change, confirm impact, and approve or discard this draft.';
}

function inferAutomationPriority_(eventKey, row) {
  if (eventKey === 'release.rolled_back') return 'Critical';
  if (eventKey === 'release.delayed' || eventKey === 'release.go_no_go') return 'High';
  if (String(row.Status || '').toUpperCase() === 'RED') return 'High';
  if (['HIGH', 'CRITICAL'].indexOf(normalizeRiskLevel_(row['Risk Level'])) >= 0) return 'High';
  return 'Medium';
}

function insertHubDraftFromAutomationAtTop_(hubId, draft) {
  const hub = SpreadsheetApp.openById(hubId);
  const queue = hub.getSheetByName('Queue');
  if (!queue) throw new Error('Hub Queue sheet is missing.');

  const duplicateQueueId = findHubActiveQueueIdByDedupeKey_(queue, draft['Dedupe Key']);
  if (duplicateQueueId) return duplicateQueueId;

  const headers = getAutomationHeaders_(queue);
  insertAutomationValuesAtTop_(queue, headers.map(header => draft[header] == null ? '' : draft[header]));
  return draft['Queue ID'];
}

function findHubActiveQueueIdByDedupeKey_(queue, dedupeKey) {
  if (!dedupeKey) return '';
  const rows = getAutomationObjects_(queue);
  const active = rows.find(row =>
    row['Dedupe Key'] === dedupeKey &&
    ['Draft', 'Approved', 'Scheduled'].indexOf(row.Status) >= 0
  );
  return active ? active['Queue ID'] : '';
}

function runAutomationGarbageCollectionIfNeeded_(automation, config) {
  const pollCount = Number(config.POLL_COUNT || 0);
  const every = Number(config.GC_EVERY_N_POLLS || 100);
  const retentionDays = Number(config.RETENTION_DAYS || 60);
  const lastGcAt = config.LAST_GC_AT ? new Date(config.LAST_GC_AT) : null;
  const now = new Date();
  const weeklyDue = !lastGcAt || now.getTime() - lastGcAt.getTime() >= 7 * 24 * 60 * 60 * 1000;
  const countDue = every > 0 && pollCount > 0 && pollCount % every === 0;

  if (!weeklyDue && !countDue) {
    return { ran: false, deletedRows: 0 };
  }

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deletedSnapshots = pruneAutomationRowsOlderThan_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS),
    'Snapshot At',
    cutoff
  );
  const deletedChanges = pruneAutomationRowsOlderThan_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES),
    'Detected At',
    cutoff
  );

  updateAutomationConfigValue_(automation, 'LAST_GC_AT', automationNowIso_());
  return {
    ran: true,
    deletedRows: deletedSnapshots + deletedChanges,
    retentionDays: retentionDays
  };
}

function pruneAutomationRowsOlderThan_(sheet, timestampHeader, cutoff) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = getAutomationHeaders_(sheet);
  const timestampIndex = headers.indexOf(timestampHeader);
  if (timestampIndex < 0) return 0;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  let deleted = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i][timestampIndex];
    const date = value instanceof Date ? value : new Date(value);
    if (value && !isNaN(date.getTime()) && date < cutoff) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function incrementAutomationPollCount_(automation, config) {
  const next = Number(config.POLL_COUNT || 0) + 1;
  updateAutomationConfigValue_(automation, 'POLL_COUNT', String(next));
  return next;
}

function updateAutomationConfigValue_(automation, key, value) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  insertAutomationValuesAtTop_(sheet, [key, value]);
}

function insertByHeadersAtTop_(sheet, headers, row) {
  insertAutomationObjectsAtTop_(sheet, headers, [row]);
}

function insertAutomationObjectsAtTop_(sheet, headers, rows) {
  if (!sheet || !rows || !rows.length) return;
  const values = rows.map(row => headers.map(header => row[header] == null ? '' : row[header]));
  sheet.insertRowsAfter(1, values.length);
  sheet.getRange(2, 1, values.length, headers.length).setNumberFormat('@').setValues(values);
}

function rewriteAutomationObjects_(sheet, headers, rows) {
  if (!sheet) return;
  const sortedRows = (rows || []).slice().sort((a, b) =>
    String(b['Last Observed At'] || '').localeCompare(String(a['Last Observed At'] || ''))
  );

  sheet.clearContents();
  sheet
    .getRange(1, 1, Math.max(sortedRows.length + 1, 1), headers.length)
    .setNumberFormat('@');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (sortedRows.length) {
    sheet
      .getRange(2, 1, sortedRows.length, headers.length)
      .setValues(sortedRows.map(row => headers.map(header => row[header] == null ? '' : row[header])));
  }
}

function insertAutomationValuesAtTop_(sheet, values) {
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, values.length).setNumberFormat('@').setValues([values]);
}

function getAutomationConfig_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(AUTOMATION.SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).reduce((obj, row) => {
    if (row[0]) obj[row[0]] = row[1];
    return obj;
  }, {});
}

function getAutomationHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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

function getAutomationObjectsByHeaders_(sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();
  return values.map(row => headers.reduce((obj, header, index) => {
    obj[header] = row[index];
    return obj;
  }, {}));
}

function isAutomationExportRowActive_(row) {
  if (!String(row['Source Item ID'] || '').trim() && !String(row['Flow ID'] || '').trim()) return false;
  return !isExplicitlyInactive_(row.Active);
}

function isExplicitlyInactive_(value) {
  const text = String(value || '').trim().toLowerCase();
  return ['false', 'no', '0', 'inactive', 'n'].indexOf(text) >= 0;
}

function isTruthy_(value) {
  const text = String(value || '').trim().toLowerCase();
  return ['true', 'yes', '1', 'y', 'checked', 'manual review', 'hold'].indexOf(text) >= 0;
}

function normalizeAutomationRecordType_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'release' || text === 'production release') return 'Release';
  if (text === 'project') return 'Project';
  return String(value || '').trim();
}

function normalizeStatus_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text.indexOf('🟢') >= 0 || /GREEN/.test(text)) return 'GREEN';
  if (text.indexOf('🟡') >= 0 || /YELLOW|AMBER/.test(text)) return 'YELLOW';
  if (text.indexOf('🔴') >= 0 || /RED/.test(text)) return 'RED';
  if (text.indexOf('⚪') >= 0 || /GRAY|GREY/.test(text)) return 'GRAY';
  if (['GREEN', 'YELLOW', 'RED', 'GRAY'].indexOf(text) >= 0) return text;
  if (/risk/i.test(text)) return 'YELLOW';
  if (/block|off/i.test(text)) return 'RED';
  if (/done|complete/i.test(text)) return 'GREEN';
  return text;
}

function normalizeRiskLevel_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (/critical/.test(text.toLowerCase())) return 'CRITICAL';
  if (/high/.test(text.toLowerCase())) return 'HIGH';
  if (/medium|med/.test(text.toLowerCase())) return 'MEDIUM';
  if (/low/.test(text.toLowerCase())) return 'LOW';
  return text;
}

function inferReleaseEventKey_(phase, notes) {
  const text = (String(phase || '') + ' ' + String(notes || '')).toLowerCase();
  if (/rollback|rolled back/.test(text)) return 'release.rolled_back';
  if (/delay|delayed|missed/.test(text)) return 'release.delayed';
  if (/complete|completed|done|released/.test(text)) return 'release.completed';
  if (/start|started|deploying|in progress/.test(text)) return 'release.started';
  if (/go|no-go|readiness/.test(text)) return 'release.go_no_go';
  if (/schedule|scheduled|planned/.test(text)) return 'release.scheduled';
  return '';
}

function parseJsonObject_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (error) {
    return {};
  }
}

function stringifyAutomationValue_(value) {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return '';
  return String(value).trim();
}

function parseAutomationDate_(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function automationTextMatches_(left, right) {
  const normalizedLeft = normalizeAutomationText_(left);
  const normalizedRight = normalizeAutomationText_(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight ||
    normalizedLeft.indexOf(normalizedRight) >= 0 ||
    normalizedRight.indexOf(normalizedLeft) >= 0;
}

function normalizeAutomationText_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hashString_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function automationNowIso_() {
  return new Date().toISOString();
}
