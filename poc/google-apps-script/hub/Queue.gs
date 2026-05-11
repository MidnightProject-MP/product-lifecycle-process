function appendQueueDraft_(draft) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const rowObject = Object.assign({
    'Queue ID': uuid_(),
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
    const template = findTemplate_(item);
    const text = renderTemplate_(template.Text, item);
    const channel = item.Channel || resolveDefaultChannel_(template['Default Channel Type']);
    const threadTs = shouldReplyInThread_(template, item) ? item['Slack Thread ID'] : '';
    const result = postSlackMessage_(channel, text, threadTs);

    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.SENT,
      'Updated At': nowIso_(),
      'Sent At': nowIso_(),
      'Slack Thread ID': result.ts,
      'Slack Message URL': result.permalink || '',
      'Error': ''
    });
  } catch (error) {
    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.ERROR,
      'Updated At': nowIso_(),
      'Error': error.message || String(error)
    });
  }
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

