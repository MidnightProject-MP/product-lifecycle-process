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
  const text = letter => letter === 'AA' ? 'IFERROR(TO_TEXT(' + range(letter) + '),"")' : 'TO_TEXT(' + range(letter) + ')';
  const signature = (prefix, letters) => '"' + prefix + '|"&' + letters.map(text).join('&CHAR(31)&');
  const sourceSignature = signature('source', [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'
  ]);
  const signalSignature = signature('signal', ['G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'U', 'AA']);

  return '=ARRAYFORMULA(IF(LEN(' + range('B') + ')=0,,{' +
    [
      text('B'),
      text('C'),
      text('A'),
      text('Z'),
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
