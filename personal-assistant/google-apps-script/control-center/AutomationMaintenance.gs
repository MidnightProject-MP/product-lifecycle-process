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

  return {
    ran: true,
    deletedRows: deletedSnapshots + deletedChanges,
    retentionDays: retentionDays,
    lastGcAt: automationNowIso_()
  };
}

function pruneAutomationRowsOlderThan_(sheet, timestampHeader, cutoff) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = getAutomationHeaders_(sheet);
  const timestampIndex = headers.indexOf(timestampHeader);
  if (timestampIndex < 0) return 0;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const retained = [];
  let deleted = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i][timestampIndex];
    const date = value instanceof Date ? value : new Date(value);
    if (value && !isNaN(date.getTime()) && date < cutoff) {
      deleted++;
    } else {
      retained.push(values[i]);
    }
  }

  if (deleted) {
    sheet.getRange(2, 1, values.length, headers.length).clearContent();
    if (retained.length) {
      sheet.getRange(2, 1, retained.length, headers.length).setValues(retained);
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
  batchUpdateAutomationConfigValues_(automation, (function() {
    const fields = {};
    fields[key] = value;
    return fields;
  })());
}

function batchUpdateAutomationConfigValues_(automation, fields) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  const missing = [];
  const updates = fields || {};
  let changed = false;
  Object.keys(updates).forEach(key => {
    let found = false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(key)) {
        values[i][1] = updates[key];
        found = true;
        changed = true;
        break;
      }
    }
    if (!found) missing.push([key, updates[key]]);
  });

  if (changed) {
    const width = Math.max(2, values[0] ? values[0].length : 2);
    const padded = values.map(row => {
      const copy = row.slice();
      while (copy.length < width) copy.push('');
      return copy.slice(0, width);
    });
    sheet.getRange(1, 1, padded.length, width).setValues(padded);
  }

  missing.forEach(row => insertAutomationValuesAtTop_(sheet, row));
}

function updateAutomationConfigValueLegacy_(automation, key, value) {
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
  if (text.indexOf('\uD83D\uDFE2') >= 0 || /GREEN/.test(text)) return 'GREEN';
  if (text.indexOf('\uD83D\uDFE1') >= 0 || /YELLOW|AMBER/.test(text)) return 'YELLOW';
  if (text.indexOf('\uD83D\uDD34') >= 0 || /RED/.test(text)) return 'RED';
  if (text.indexOf('\u26AA') >= 0 || /GRAY|GREY/.test(text)) return 'GRAY';
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

function normalizeAutomationSlug_(value) {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'item';
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
