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
