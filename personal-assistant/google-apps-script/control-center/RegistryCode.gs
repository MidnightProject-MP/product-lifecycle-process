function setupRegistrySheets() {
  const ss = SpreadsheetApp.getActive();
  const settings = ensureRegistrySheet_(ss, REGISTRY.SHEETS.SETTINGS, REGISTRY.HEADERS.SETTINGS);
  const eventCatalog = ensureRegistrySheet_(ss, REGISTRY.SHEETS.EVENT_CATALOG, REGISTRY.HEADERS.EVENT_CATALOG);
  const templates = ensureRegistrySheet_(ss, REGISTRY.SHEETS.TEMPLATES, REGISTRY.HEADERS.TEMPLATES);
  const variables = ensureRegistrySheet_(ss, REGISTRY.SHEETS.TEMPLATE_VARIABLES, REGISTRY.HEADERS.TEMPLATE_VARIABLES);
  const transitions = ensureRegistrySheet_(ss, REGISTRY.SHEETS.EVENT_TRANSITIONS, REGISTRY.HEADERS.EVENT_TRANSITIONS);
  const approvalRules = ensureRegistrySheet_(ss, REGISTRY.SHEETS.APPROVAL_RULES, REGISTRY.HEADERS.APPROVAL_RULES);

  seedRegistryRows_(settings, 'Key', REGISTRY.SEED.SETTINGS);
  migrateLegacyRoutingToSettings_(ss, settings);
  seedRegistryRows_(eventCatalog, 'Event Key', REGISTRY.SEED.EVENT_CATALOG);
  seedRegistryRows_(templates, 'Template Key', REGISTRY.SEED.TEMPLATES);
  upgradeTemplateSubjectVariables_(templates);
  replaceRegistryRows_(variables, REGISTRY.HEADERS.TEMPLATE_VARIABLES, buildTemplateVariableSeed_());
  seedRegistryRows_(transitions, 'Event Key', REGISTRY.SEED.EVENT_TRANSITIONS);
  seedRegistryRows_(approvalRules, 'Event Key', REGISTRY.SEED.APPROVAL_RULES);
  applyReleaseRegistryDefaults_(eventCatalog, templates, transitions, approvalRules);
}

function ensureRegistrySheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  enforceRegistryHeaders_(sheet, headers);
  return sheet;
}

function enforceRegistryHeaders_(sheet, headers) {
  const currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0];
  const existing = current.filter(value => value !== '');
  const merged = headers.slice();

  existing.forEach(header => {
    if (merged.indexOf(header) < 0) merged.push(header);
  });

  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
}

function seedRegistryRows_(sheet, keyFields, rows) {
  const headers = getRegistryHeaders_(sheet);
  const keys = String(keyFields).split('|');
  const existing = {};
  getRegistrySheetObjects_(sheet).forEach((row, index) => {
    const key = buildRegistryCompositeKey_(row, keys);
    if (!existing[key]) existing[key] = index + 2;
  });

  rows.slice().reverse().forEach(row => {
    const key = buildRegistryCompositeKey_(row, keys);
    if (existing[key]) {
      fillBlankRegistryFields_(sheet, existing[key], headers, row);
      return;
    }
    insertRegistryValuesAtTop_(sheet, headers.map(header => row[header] == null ? '' : row[header]));
  });
}

function fillBlankRegistryFields_(sheet, rowNumber, headers, seedRow) {
  const current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const updates = current.slice();
  let changed = false;

  headers.forEach((header, index) => {
    if (seedRow[header] == null || seedRow[header] === '') return;
    if (updates[index] != null && updates[index] !== '') return;
    updates[index] = seedRow[header];
    changed = true;
  });

  if (changed) {
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([updates]);
  }
}

function upsertRegistryRows_(sheet, keyFields, rows) {
  const headers = getRegistryHeaders_(sheet);
  const keys = String(keyFields).split('|');
  const existing = {};
  getRegistrySheetObjects_(sheet).forEach((row, index) => {
    const key = buildRegistryCompositeKey_(row, keys);
    if (!existing[key]) existing[key] = index + 2;
  });

  rows.slice().reverse().forEach(row => {
    const key = buildRegistryCompositeKey_(row, keys);
    if (existing[key]) {
      sheet.getRange(existing[key], 1, 1, headers.length).setValues([headers.map(header => row[header] == null ? '' : row[header])]);
      return;
    }
    insertRegistryValuesAtTop_(sheet, headers.map(header => row[header] == null ? '' : row[header]));
  });
}

function applyReleaseRegistryDefaults_(eventCatalog, templates, transitions, approvalRules) {
  upsertRegistryRows_(eventCatalog, 'Event Key', getReleaseSeedRows_(REGISTRY.SEED.EVENT_CATALOG, 'Event Key'));
  upsertRegistryRows_(templates, 'Template Key', getReleaseTemplateSeedRows_());
  deactivateRegistryRows_(templates, 'Template Key', ['release-update', 'release-execution', 'release-exception', 'postmortem-needed']);
  upsertRegistryRows_(transitions, 'Event Key', getReleaseSeedRows_(REGISTRY.SEED.EVENT_TRANSITIONS, 'Event Key'));
  upsertRegistryRows_(approvalRules, 'Event Key', getReleaseSeedRows_(REGISTRY.SEED.APPROVAL_RULES, 'Event Key'));
}

function refreshReleaseRegistryDefaults() {
  const ss = SpreadsheetApp.getActive();
  applyReleaseRegistryDefaults_(
    ensureRegistrySheet_(ss, REGISTRY.SHEETS.EVENT_CATALOG, REGISTRY.HEADERS.EVENT_CATALOG),
    ensureRegistrySheet_(ss, REGISTRY.SHEETS.TEMPLATES, REGISTRY.HEADERS.TEMPLATES),
    ensureRegistrySheet_(ss, REGISTRY.SHEETS.EVENT_TRANSITIONS, REGISTRY.HEADERS.EVENT_TRANSITIONS),
    ensureRegistrySheet_(ss, REGISTRY.SHEETS.APPROVAL_RULES, REGISTRY.HEADERS.APPROVAL_RULES)
  );
}

function refreshTemplateScaffolds() {
  const ss = SpreadsheetApp.getActive();
  upsertRegistryRows_(
    ensureRegistrySheet_(ss, REGISTRY.SHEETS.TEMPLATES, REGISTRY.HEADERS.TEMPLATES),
    'Template Key',
    REGISTRY.SEED.TEMPLATES
  );
}

function getReleaseSeedRows_(rows, keyField) {
  return rows.filter(row => String(row[keyField] || '').indexOf('release.') === 0);
}

function getReleaseTemplateSeedRows_() {
  const templateKeys = {
    'release-scheduled': true,
    'release-go-no-go': true,
    'release-started': true,
    'release-completed': true,
    'release-delayed': true,
    'release-rollback-evaluating': true,
    'release-rollback-decision': true,
    'release-rolled-back': true,
    'release-postmortem-needed': true
  };
  return REGISTRY.SEED.TEMPLATES.filter(row => templateKeys[row['Template Key']]);
}

function deactivateRegistryRows_(sheet, keyField, keys) {
  const headers = getRegistryHeaders_(sheet);
  const keyIndex = headers.indexOf(keyField);
  const activeIndex = headers.indexOf('Active');
  if (keyIndex < 0 || activeIndex < 0 || sheet.getLastRow() < 2) return;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const inactiveKeys = keys.reduce((obj, key) => {
    obj[key] = true;
    return obj;
  }, {});

  values.forEach((row, index) => {
    if (!inactiveKeys[row[keyIndex]]) return;
    if (String(row[activeIndex]).toUpperCase() === 'FALSE') return;
    sheet.getRange(index + 2, activeIndex + 1).setValue('FALSE');
  });
}

function replaceRegistryRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows.map(row => {
      return headers.map(header => row[header] == null ? '' : row[header]);
    }));
  }
}

function upgradeTemplateSubjectVariables_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return;

  const headers = getRegistryHeaders_(sheet);
  const textColumns = ['Anchor Text', 'Reply Text', 'Text']
    .map(header => headers.indexOf(header) + 1)
    .filter(column => column > 0);
  if (!textColumns.length) return;

  const rowCount = sheet.getLastRow() - 1;
  textColumns.forEach(column => {
    const range = sheet.getRange(2, column, rowCount, 1);
    const values = range.getValues();
    let changed = false;
    const updated = values.map(row => {
      const current = row[0];
      const next = String(current || '')
        .replace(/\{\{\s*project\s*\}\}/g, '{{subject}}')
        .replace(/\{\{\s*release_name\s*\}\}/g, '{{subject}}')
        .replace(/\{\{\s*issue_title\s*\}\}/g, '{{subject}}');
      if (next !== current) changed = true;
      return [next];
    });
    if (changed) range.setValues(updated);
  });
}

function getRegistryHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getRegistrySheetObjects_(sheet) {
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

function buildRegistryCompositeKey_(row, keys) {
  return keys.map(key => String(row[key] || '')).join('|');
}

function insertRegistryValuesAtTop_(sheet, values) {
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, values.length).setValues([values]);
}

function buildTemplateVariableSeed_() {
  return REGISTRY.SEED.TEMPLATE_VARIABLES;
}

function migrateLegacyRoutingToSettings_(ss, settingsSheet) {
  const routing = ss.getSheetByName('Routing');
  if (!routing) return;

  const settingsHeaders = getRegistryHeaders_(settingsSheet);
  const settingKeyColumn = settingsHeaders.indexOf('Key') + 1;
  const settingValueColumn = settingsHeaders.indexOf('Value') + 1;
  if (!settingKeyColumn || !settingValueColumn) return;

  const existingSettings = getRegistrySheetObjects_(settingsSheet);
  getRegistrySheetObjects_(routing).forEach(route => {
    const channelId = route['Channel ID'];
    if (!channelId) return;

    const settingKey = buildRegistryChannelSettingKey_(route['Channel Type']);
    const settingIndex = existingSettings.findIndex(setting => String(setting.Key) === settingKey);
    if (settingIndex < 0 || existingSettings[settingIndex].Value) return;

    settingsSheet.getRange(settingIndex + 2, settingValueColumn).setValue(channelId);
    existingSettings[settingIndex].Value = channelId;
  });

  archiveLegacyRoutingSheet_(ss, routing);
}

function buildRegistryChannelSettingKey_(channelType) {
  const normalized = String(channelType || 'PROJECT').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return 'DEFAULT_' + normalized + '_CHANNEL';
}

function archiveLegacyRoutingSheet_(ss, routing) {
  const archivedName = ss.getSheetByName('Legacy_Routing')
    ? 'Legacy_Routing_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss')
    : 'Legacy_Routing';
  routing.setName(archivedName);
  if (ss.getSheets().length > 1) routing.hideSheet();
}

function variable_(variableKey, label, required, source, description, example) {
  return {
    'Variable Key': variableKey,
    Label: label,
    Required: required,
    Source: source,
    Description: description,
    Example: example,
    Active: 'TRUE'
  };
}
