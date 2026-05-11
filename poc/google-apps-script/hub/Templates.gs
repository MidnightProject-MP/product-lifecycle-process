function findTemplate_(item) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(HUB.SHEETS.TEMPLATES);
  if (!sheet) throw new Error('Templates sheet is missing.');

  const rows = getObjects_(sheet);
  const key = String(item['Template Key'] || '').trim();

  if (key) {
    const match = rows.find(row => row['Template Key'] === key);
    if (match) return match;
    logHub_('WARN', 'findTemplate_', item['Queue ID'], 'Template key did not match any template.', { templateKey: key });
  }

  const match = rows.find(row =>
    row.Lane === item.Lane &&
    row['Communication Event'] === item['Communication Event'] &&
    (!row['Lifecycle Stage'] || row['Lifecycle Stage'] === item['Lifecycle Stage']) &&
    (!row.Scenario || row.Scenario === item.Scenario)
  );

  if (!match) {
    logHub_('ERROR', 'findTemplate_', item['Queue ID'], 'No matching template found.', {
      lane: item.Lane,
      event: item['Communication Event'],
      lifecycleStage: item['Lifecycle Stage'],
      scenario: item.Scenario
    });
    throw new Error('No matching template found for queue item.');
  }
  return match;
}

function renderTemplate_(text, item) {
  return String(text || '').replace(/\{\{([^}]+)\}\}/g, (_, token) => {
    const key = token.trim();
    return item[key] == null ? '' : String(item[key]);
  });
}

function getObjects_(sheet) {
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

function shouldReplyInThread_(template, item) {
  return String(template['Post Mode']) === 'Reply In Thread';
}

function resolveDefaultChannel_(channelType) {
  const type = String(channelType || '').toUpperCase();
  if (type === 'INCIDENT') return getScriptProperty_('DEFAULT_INCIDENT_CHANNEL');
  if (type === 'RELEASE') return getScriptProperty_('DEFAULT_RELEASE_CHANNEL');
  return getScriptProperty_('DEFAULT_PROJECT_CHANNEL');
}
