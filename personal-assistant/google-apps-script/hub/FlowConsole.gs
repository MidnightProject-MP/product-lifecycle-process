const FLOW_CONSOLE_FIELDS = [
  ['Flow ID', '', 'Select the active communication flow to update.'],
  ['Subject', '', 'Current flow subject. Read-only.'],
  ['Current state', '', 'Latest sent communication state. Read-only.'],
  ['Expected next step', '', 'Next happy-path communication state. Read-only.'],
  ['Available detours', '', 'Manual detours allowed from the current state. Read-only.'],
  ['Action', 'Continue expected path', 'Choose what happened.'],
  ['What changed?', '', 'One concise factual update.'],
  ['Why it matters', '', 'Business impact or stakeholder meaning.'],
  ['What happens next?', '', 'Next action, owner, timing, or decision.'],
  ['Owner', '', 'Communication owner.'],
  ['Priority', 'Medium', 'Low, Medium, High, or Critical.'],
  ['Draft Queue ID', '', 'Created or updated draft. Read-only.'],
  ['Console Status', '', 'Latest console result. Read-only.'],
  ['Last Updated', '', 'Latest console refresh or draft creation time. Read-only.']
];

function refreshFlowConsole() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    logHub_('WARN', 'refreshFlowConsole', '', 'Skipped because Hub processing lock was unavailable.', {});
    return;
  }

  try {
    const sheet = ensureFlowConsoleSheet_();
    configureFlowConsoleSheet_(sheet);
    refreshFlowConsoleState_(sheet);
  } finally {
    lock.releaseLock();
  }
}

function handleFlowConsoleEdit_(e, sheet) {
  if (!e || !e.range) return;

  const range = e.range;
  if (range.getRow() === 1 || range.getColumn() !== 2 || range.getNumColumns() !== 1) {
    return;
  }

  const editedFields = getFlowConsoleEditedFields_(sheet, range);
  if (!editedFields.length) return;

  const shouldRefresh = editedFields.some(field =>
    ['Flow ID', 'Action'].indexOf(field) >= 0
  );
  if (!shouldRefresh) return;

  refreshFlowConsoleState_(sheet);
  logHub_('INFO', 'handleFlowConsoleEdit_', '', 'Flow Console context refreshed after edit.', {
    editedFields: editedFields
  });
}

function createDraftFromFlowConsole() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    logHub_('WARN', 'createDraftFromFlowConsole', '', 'Skipped because Hub processing lock was unavailable.', {});
    return;
  }

  try {
    const sheet = ensureFlowConsoleSheet_();
    configureFlowConsoleSheet_(sheet);
    const values = getFlowConsoleValues_(sheet);
    const flowId = String(values['Flow ID'] || '').trim();
    if (!flowId) throw new Error('Select a Flow ID in Flow_Console first.');

    const flow = findFlowStateByFlowId_(flowId);
    if (!flow) throw new Error('Flow not found in Flow_State: ' + flowId);

    const action = String(values.Action || HUB.FLOW_ACTION.CONTINUE).trim();
    const eventKey = resolveFlowConsoleEventKey_(flow, action);
    if (!eventKey) throw new Error('No event could be resolved for action: ' + action);

    const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey);
    if (!event) throw new Error('Registry is missing Event_Catalog row for: ' + eventKey);

    const payload = buildFlowConsolePayload_(flow, values, eventKey);
    const priority = values.Priority || event.Severity || 'Medium';
    const draft = {
      Source: 'Flow Console',
      Lane: flow['Flow Type'] || event.Lane || inferLaneFromEventKey_(eventKey),
      'Event Key': eventKey,
      Status: HUB.STATUS.DRAFT,
      Priority: priority,
      Owner: values.Owner || flow.Owner || payload.owner || '',
      'Flow ID': flowId,
      'Dedupe Key': buildFlowConsoleDedupeKey_(flow, eventKey, payload),
      'Parent Queue ID': flow['Last Queue ID'] || '',
      'Expected Previous Event Key': flow['Current Event Key'] || '',
      'Path Override': action === HUB.FLOW_ACTION.CONTINUE ? 'Happy Path' : 'Sad Path',
      'Payload JSON': stringifyJson_(payload)
    };

    const queueId = upsertFlowConsoleDraft_(draft);
    if (action !== HUB.FLOW_ACTION.CONTINUE) {
      archiveScheduledDraftsForFlowExceptEvent_(flowId, eventKey, 'Superseded by Flow Console detour draft ' + queueId);
    }

    syncReviewSheetFromQueueSafe_();
    refreshFlowConsoleState_(sheet);
    setFlowConsoleValue_(sheet, 'Draft Queue ID', queueId);
    setFlowConsoleValue_(sheet, 'Console Status', 'Draft ready for review: ' + getEventDisplayName_(eventKey));
    setFlowConsoleValue_(sheet, 'Last Updated', nowIso_());

    logHub_('INFO', 'createDraftFromFlowConsole', queueId, 'Flow Console draft created or updated.', {
      flowId: flowId,
      action: action,
      eventKey: eventKey
    });
  } catch (error) {
    const sheet = ensureFlowConsoleSheet_();
    setFlowConsoleValue_(sheet, 'Console Status', 'Error: ' + (error.message || String(error)));
    setFlowConsoleValue_(sheet, 'Last Updated', nowIso_());
    logHub_('ERROR', 'createDraftFromFlowConsole', '', 'Failed to create Flow Console draft.', {
      error: error.message || String(error),
      stack: error.stack || ''
    });
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function ensureFlowConsoleSheet_() {
  const ss = SpreadsheetApp.getActive();
  return ensureSheet_(ss, HUB.SHEETS.FLOW_CONSOLE, HUB.HEADERS.FLOW_CONSOLE);
}

function configureFlowConsoleSheet_(sheet) {
  sheet.setFrozenRows(1);
  ensureFlowConsoleRows_(sheet);
  applyFlowConsoleValidation_(sheet);
  sheet.autoResizeColumns(1, 3);
}

function ensureFlowConsoleRows_(sheet) {
  const existing = getFlowConsoleValues_(sheet);
  const rows = FLOW_CONSOLE_FIELDS.map(field => {
    const label = field[0];
    const defaultValue = field[1];
    const help = field[2];
    const currentValue = existing[label];
    return [label, currentValue == null || currentValue === '' ? defaultValue : currentValue, help];
  });

  sheet.getRange(1, 1, 1, HUB.HEADERS.FLOW_CONSOLE.length).setValues([HUB.HEADERS.FLOW_CONSOLE]);
  sheet.getRange(2, 1, rows.length, HUB.HEADERS.FLOW_CONSOLE.length).setValues(rows);
}

function applyFlowConsoleValidation_(sheet) {
  const flowIds = getActiveFlowIds_();
  applyFlowConsoleDropdown_(sheet, 'Flow ID', flowIds);
  applyFlowConsoleDropdown_(sheet, 'Action', Object.keys(HUB.FLOW_ACTION).map(key => HUB.FLOW_ACTION[key]));
  applyFlowConsoleDropdown_(sheet, 'Priority', ['Low', 'Medium', 'High', 'Critical']);
}

function applyFlowConsoleDropdown_(sheet, field, values) {
  const row = findFlowConsoleFieldRow_(sheet, field);
  if (!row || !values.length) return;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 2).setDataValidation(rule);
}

function applyFlowConsoleActionValidationForFlow_(sheet, flow) {
  const actionRow = findFlowConsoleFieldRow_(sheet, 'Action');
  if (!actionRow) return;

  const actions = getAvailableFlowConsoleActions_(flow);
  if (!actions.length) return;

  const currentAction = String(getFlowConsoleValues_(sheet).Action || '').trim();
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(actions, true)
    .setAllowInvalid(false)
    .build();
  const range = sheet.getRange(actionRow, 2);
  range.setDataValidation(rule);

  if (actions.indexOf(currentAction) < 0) {
    range.setValue(actions[0]);
  }
}

function refreshFlowConsoleState_(sheet) {
  const values = getFlowConsoleValues_(sheet);
  const flowId = String(values['Flow ID'] || '').trim();
  if (!flowId) {
    setFlowConsoleValue_(sheet, 'Console Status', 'Select a Flow ID, choose an action, then create a draft.');
    setFlowConsoleValue_(sheet, 'Last Updated', nowIso_());
    return;
  }

  const flow = findFlowStateByFlowId_(flowId);
  if (!flow) {
    setFlowConsoleValue_(sheet, 'Console Status', 'Flow not found: ' + flowId);
    setFlowConsoleValue_(sheet, 'Last Updated', nowIso_());
    return;
  }

  setFlowConsoleValue_(sheet, 'Subject', flow.Subject || flowId);
  setFlowConsoleValue_(sheet, 'Current state', getEventDisplayName_(flow['Current Event Key']));
  setFlowConsoleValue_(sheet, 'Expected next step', flow['Next Happy Event Key'] ? getEventDisplayName_(flow['Next Happy Event Key']) : 'No expected next step');
  setFlowConsoleValue_(sheet, 'Available detours', describeEventKeyList_(getFlowAllowedDetourEventKeys_(flow)));
  applyFlowConsoleActionValidationForFlow_(sheet, flow);
  if (!values.Owner && flow.Owner) setFlowConsoleValue_(sheet, 'Owner', flow.Owner);
  setFlowConsoleValue_(sheet, 'Console Status', 'Ready.');
  setFlowConsoleValue_(sheet, 'Last Updated', nowIso_());
}

function getFlowConsoleEditedFields_(sheet, range) {
  return sheet.getRange(range.getRow(), 1, range.getNumRows(), 1).getValues()
    .map(row => row[0])
    .filter(field => field);
}

function getFlowConsoleValues_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return values.reduce((obj, row) => {
    if (row[0]) obj[row[0]] = row[1];
    return obj;
  }, {});
}

function setFlowConsoleValue_(sheet, field, value) {
  const row = findFlowConsoleFieldRow_(sheet, field);
  if (!row) return;
  sheet.getRange(row, 2).setValue(value == null ? '' : value);
}

function findFlowConsoleFieldRow_(sheet, field) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(field)) return i + 2;
  }
  return 0;
}

function getActiveFlowIds_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.FLOW_STATE);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return getObjects_(sheet)
    .filter(row => String(row['Flow Status'] || '').toLowerCase() !== 'completed')
    .map(row => row['Flow ID'])
    .filter((flowId, index, flowIds) => flowId && flowIds.indexOf(flowId) === index);
}

function resolveFlowConsoleEventKey_(flow, action) {
  if (action === HUB.FLOW_ACTION.CONTINUE) return flow['Next Happy Event Key'] || '';
  if (action === HUB.FLOW_ACTION.DELAY) return findAllowedDetourEvent_(flow, ['delayed', 'delay']) || releaseFallbackEvent_(flow, 'release.delayed');
  if (action === HUB.FLOW_ACTION.EVALUATE_ROLLBACK) return findAllowedDetourEvent_(flow, ['rollback_evaluating', 'evaluating']) || releaseFallbackEvent_(flow, 'release.rollback_evaluating');
  if (action === HUB.FLOW_ACTION.ROLLBACK_DECISION) return findAllowedDetourEvent_(flow, ['rollback_decision', 'decision']) || releaseFallbackEvent_(flow, 'release.rollback_decision');
  if (action === HUB.FLOW_ACTION.ROLLBACK) return findAllowedDetourEvent_(flow, ['rolled_back']) || releaseFallbackEvent_(flow, 'release.rolled_back');
  if (action === HUB.FLOW_ACTION.POSTMORTEM) return findAllowedDetourEvent_(flow, ['postmortem']) || releaseFallbackEvent_(flow, 'release.postmortem_needed');
  return '';
}

function findAllowedDetourEvent_(flow, tokens) {
  const allowed = String(getFlowAllowedDetourEventKeys_(flow) || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value);

  return allowed.find(eventKey => tokens.some(token => eventKey.indexOf(token) >= 0)) || '';
}

function releaseFallbackEvent_(flow, eventKey) {
  return String(flow['Flow Type'] || '') === 'Production Release' ? eventKey : '';
}

function getAvailableFlowConsoleActions_(flow) {
  const actions = [];
  if (flow['Next Happy Event Key']) actions.push(HUB.FLOW_ACTION.CONTINUE);

  const allowed = String(getFlowAllowedDetourEventKeys_(flow) || '').toLowerCase();
  const useFallback = shouldUseReleaseFallbackActions_(flow);
  if (allowed.indexOf('delay') >= 0 || allowed.indexOf('delayed') >= 0 || (useFallback && releaseFallbackEvent_(flow, 'release.delayed'))) {
    actions.push(HUB.FLOW_ACTION.DELAY);
  }
  if (allowed.indexOf('rollback_evaluating') >= 0 || (useFallback && releaseFallbackEvent_(flow, 'release.rollback_evaluating'))) {
    actions.push(HUB.FLOW_ACTION.EVALUATE_ROLLBACK);
  }
  if (allowed.indexOf('rollback_decision') >= 0 || (useFallback && releaseFallbackEvent_(flow, 'release.rollback_decision'))) {
    actions.push(HUB.FLOW_ACTION.ROLLBACK_DECISION);
  }
  if (allowed.indexOf('rolled_back') >= 0 || (useFallback && releaseFallbackEvent_(flow, 'release.rolled_back'))) {
    actions.push(HUB.FLOW_ACTION.ROLLBACK);
  }
  if (allowed.indexOf('postmortem') >= 0 || (useFallback && releaseFallbackEvent_(flow, 'release.postmortem_needed'))) {
    actions.push(HUB.FLOW_ACTION.POSTMORTEM);
  }

  return actions.filter((action, index) => actions.indexOf(action) === index);
}

function shouldUseReleaseFallbackActions_(flow) {
  return String(flow['Flow Type'] || '') === 'Production Release' &&
    !String(getFlowAllowedDetourEventKeys_(flow) || '').trim();
}

function buildFlowConsolePayload_(flow, values, eventKey) {
  const payload = getFlowStatePayload_(flow);
  payload.event_key = eventKey;
  payload.flow_id = flow['Flow ID'];
  payload.owner = values.Owner || flow.Owner || payload.owner || '';
  payload.what = values['What changed?'] || payload.what || getEventDisplayName_(eventKey);
  payload.so_what = values['Why it matters'] || payload.so_what || '';
  payload.whats_next = values['What happens next?'] || payload.whats_next || '';

  const subject = flow.Subject || payload.release_name || payload.project || payload.issue_title || flow['Flow ID'];
  if (!payload.subject) payload.subject = subject;
  if (!payload.release_name && String(flow['Flow Type'] || '') === 'Production Release') payload.release_name = subject;
  if (!payload.project) payload.project = subject;
  return payload;
}

function buildFlowConsoleDedupeKey_(flow, eventKey, payload) {
  return [
    'flow-console',
    flow['Flow ID'],
    flow['Current Event Key'],
    eventKey,
    normalizeHubKey_(payload.what || payload.whats_next || '')
  ].join('|');
}

function upsertFlowConsoleDraft_(draft) {
  const sheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const existingRow = findActiveQueueRowByFlowAndEvent_(sheet, draft['Flow ID'], draft['Event Key']);
  draft['Payload JSON'] = stringifyJson_(normalizePayload_(draft));

  if (!existingRow) return insertQueueDraftAtTop_(draft);

  updateRowFields_(sheet, existingRow, {
    Source: draft.Source,
    Lane: draft.Lane,
    'Event Key': draft['Event Key'],
    Status: HUB.STATUS.DRAFT,
    Priority: draft.Priority,
    Owner: draft.Owner,
    'Parent Queue ID': draft['Parent Queue ID'],
    'Expected Previous Event Key': draft['Expected Previous Event Key'],
    'Path Override': draft['Path Override'],
    'Payload JSON': draft['Payload JSON'],
    'Updated At': nowIso_(),
    Error: ''
  });

  const item = getRowObject_(sheet, existingRow);
  runSkill('record_graph_memory', {
    action: 'draft_updated',
    item: item
  });
  logHub_('INFO', 'upsertFlowConsoleDraft_', item['Queue ID'], 'Updated existing active draft from Flow Console.', {
    flowId: draft['Flow ID'],
    eventKey: draft['Event Key']
  });
  return item['Queue ID'];
}

function findActiveQueueRowByFlowAndEvent_(sheet, flowId, eventKey) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = getHeaders_(sheet);
  const flowIdIndex = headers.indexOf('Flow ID');
  const eventKeyIndex = headers.indexOf('Event Key');
  const statusIndex = headers.indexOf('Status');
  if (flowIdIndex < 0 || eventKeyIndex < 0 || statusIndex < 0) return 0;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const status = String(values[i][statusIndex] || '').trim();
    if (
      String(values[i][flowIdIndex]) === String(flowId) &&
      String(values[i][eventKeyIndex]) === String(eventKey) &&
      [HUB.STATUS.DRAFT, HUB.STATUS.SCHEDULED, HUB.STATUS.ERROR].indexOf(status) >= 0
    ) {
      return i + 2;
    }
  }

  return 0;
}

function archiveScheduledDraftsForFlowExceptEvent_(flowId, eventKey, reason) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet || sheet.getLastRow() < 2) return;

  getObjects_(sheet)
    .filter(row =>
      row['Flow ID'] === flowId &&
      row['Event Key'] !== eventKey &&
      String(row.Status || '').trim() === HUB.STATUS.SCHEDULED
    )
    .map(row => row['Queue ID'])
    .forEach(queueId => {
      const row = findQueueRowByQueueId_(sheet, queueId);
      if (!row) return;
      archiveAndDeleteQueueRow_(sheet, row, HUB.STATUS.DISCARDED, reason);
    });
}

function describeEventKeyList_(eventKeys) {
  const keys = String(eventKeys || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value);
  if (!keys.length) return 'No detours configured';
  return keys.map(getEventDisplayName_).join(', ');
}
