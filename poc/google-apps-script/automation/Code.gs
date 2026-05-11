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

