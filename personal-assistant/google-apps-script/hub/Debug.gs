function debugCreateHubSmokeDraftLogOnly() {
  const queueId = insertQueueDraftAtTop_(buildHubSmokeDraft_('Log Only'));
  logHub_('INFO', 'debugCreateHubSmokeDraftLogOnly', queueId, 'Created Hub smoke-test draft.', {});
  return queueId;
}

function debugRunHubSmokeTestLogOnly() {
  debugCheckHubConfiguration();
  const queueId = debugCreateHubSmokeDraftLogOnly();
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet) throw new Error('Queue sheet is missing.');
  sendApprovedQueueRow_(sheet, 2);
  const historyItem = findHistoryItemByQueueId_(queueId);
  if (!historyItem || historyItem.Status !== HUB.STATUS.LOGGED) {
    throw new Error('Hub log-only smoke test did not complete. History status is: ' + (historyItem ? historyItem.Status : 'missing') + '.');
  }
  logHub_('INFO', 'debugRunHubSmokeTestLogOnly', queueId, 'Completed Hub log-only smoke test.', {});
  return queueId;
}

function debugRunKernelSmokeTestLogOnly() {
  return withHubBufferedLogging_(function() {
    return withHubDeferredReviewSync_(debugRunKernelSmokeTestLogOnly_);
  });
}

function debugRunKernelSmokeTestLogOnly_() {
  debugCheckHubConfiguration();
  debugKernelSmokeCheckpoint_('', 'Configuration check passed.', {});

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const draft = buildHubSmokeDraft_('Log Only');
  draft['Flow ID'] = 'debug-kernel-smoke-test-' + stamp;
  draft['Dedupe Key'] = 'debug|kernel-smoke-test|' + stamp;
  debugKernelSmokeCheckpoint_('', 'Queueing kernel smoke draft.', {
    flowId: draft['Flow ID']
  });

  const queueRun = runSkill('queue_communication_draft', {
    draft: draft
  });
  if (!queueRun.ok) throw new Error('queue_communication_draft failed: ' + queueRun.error.message);

  const queueId = queueRun.output.queueId;
  debugKernelSmokeCheckpoint_(queueId, 'Kernel smoke draft queued.', {
    queueSkillRunId: queueRun.runId
  });

  const queueSheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  const queueRow = findQueueRowByQueueId_(queueSheet, queueId);
  if (!queueRow) throw new Error('Kernel smoke draft was queued but no active Queue row was found: ' + queueId);
  debugKernelSmokeCheckpoint_(queueId, 'Approving kernel smoke draft.', {
    queueRow: queueRow
  });

  const approveRun = runSkill('approve_draft', {
    queueId: queueId,
    row: queueRow
  }, { parentRunId: queueRun.runId });
  if (!approveRun.ok) throw new Error('approve_draft failed: ' + approveRun.error.message);
  debugKernelSmokeCheckpoint_(queueId, 'Kernel smoke draft approved.', {
    approveSkillRunId: approveRun.runId
  });

  const historyItem = findHistoryItemByQueueId_(queueId);
  if (!historyItem || historyItem.Status !== HUB.STATUS.LOGGED) {
    throw new Error('Kernel smoke test did not log History correctly. History status is: ' + (historyItem ? historyItem.Status : 'missing') + '.');
  }
  debugKernelSmokeCheckpoint_(queueId, 'History verification passed.', {
    historyStatus: historyItem.Status
  });

  const flow = findFlowStateByFlowId_(draft['Flow ID']);
  if (!flow || flow['Last Queue ID'] !== queueId) {
    throw new Error('Kernel smoke test did not update Flow_State for Queue ID: ' + queueId);
  }
  debugKernelSmokeCheckpoint_(queueId, 'Flow_State verification passed.', {
    flowStatus: flow['Flow Status']
  });

  const graphSummary = buildKernelSmokeGraphSummary_(draft['Flow ID'], queueId);
  if (!graphSummary.entityFound || graphSummary.wNodeCount < GRAPH_W_DIMENSIONS.length || graphSummary.eventCount < 1) {
    throw new Error('Kernel smoke test did not record expected graph memory: ' + JSON.stringify(graphSummary));
  }
  debugKernelSmokeCheckpoint_(queueId, 'Graph verification passed.', graphSummary);

  flushHubLogBuffers_();
  const skillSummary = buildKernelSmokeSkillSummary_(queueRun.runId, approveRun.runId);
  if (skillSummary.errorCount > 0) {
    throw new Error('Kernel smoke test found Skill_Run_Log errors: ' + JSON.stringify(skillSummary));
  }
  debugKernelSmokeCheckpoint_(queueId, 'Skill_Run_Log verification passed.', skillSummary);

  const result = {
    queueId: queueId,
    flowId: draft['Flow ID'],
    queueSkillRunId: queueRun.runId,
    approveSkillRunId: approveRun.runId,
    historyStatus: historyItem.Status,
    flowStatus: flow['Flow Status'],
    graph: graphSummary,
    skills: skillSummary
  };
  logHub_('INFO', 'debugRunKernelSmokeTestLogOnly', queueId, 'Completed kernel log-only smoke test.', result);
  return JSON.stringify(result);
}

function debugCreateHubSlackSmokeDraft() {
  debugCheckHubConfiguration();
  const queueId = insertQueueDraftAtTop_(buildHubSmokeDraft_(''));
  logHub_('INFO', 'debugCreateHubSlackSmokeDraft', queueId, 'Created Hub Slack smoke-test draft.', {});
  return queueId;
}

function debugProcessApprovedQueueRows() {
  const processed = processApprovedQueueRows_();
  logHub_('INFO', 'debugProcessApprovedQueueRows', '', 'Processed approved Queue rows from debug scan.', {
    processed: processed
  });
  return processed;
}

function debugCheckHubConfiguration() {
  const registryId = getScriptProperty_('REGISTRY_SPREADSHEET_ID');
  const slackToken = getScriptProperty_('SLACK_BOT_TOKEN');
  const result = {
    registrySpreadsheetIdConfigured: registryId ? 'TRUE' : 'FALSE',
    slackBotTokenConfigured: slackToken ? 'TRUE' : 'FALSE',
    registryReachable: 'FALSE',
    projectEventConfigured: 'FALSE',
    projectTemplateConfigured: 'FALSE',
    projectChannelConfigured: 'FALSE',
    transitionRulesConfigured: 'FALSE'
  };

  if (!registryId) {
    logHub_('ERROR', 'debugCheckHubConfiguration', '', 'Missing required Hub Script Property.', {
      property: 'REGISTRY_SPREADSHEET_ID'
    });
    throw new Error('Missing REGISTRY_SPREADSHEET_ID script property.');
  }

  const registry = getRegistrySpreadsheet_();
  result.registryReachable = registry.getId() === registryId ? 'TRUE' : 'FALSE';

  const event = findRegistryRow_('Event_Catalog', 'Event Key', 'project.unexpected_status_change');
  result.projectEventConfigured = event ? 'TRUE' : 'FALSE';
  if (!event) throw new Error('Registry is missing project.unexpected_status_change in Event_Catalog.');

  const template = findRegistryRow_('Templates', 'Template Key', event['Template Key']);
  result.projectTemplateConfigured = template ? 'TRUE' : 'FALSE';
  if (!template) throw new Error('Registry is missing template: ' + event['Template Key']);

  const transition = findRegistryRow_('Event_Transitions', 'Event Key', 'project.unexpected_status_change');
  result.transitionRulesConfigured = transition ? 'TRUE' : 'FALSE';

  const projectChannel = getRegistrySetting_(buildChannelSettingKey_('Project'));
  result.projectChannelConfigured = projectChannel ? 'TRUE' : 'FALSE';
  if (!projectChannel) throw new Error('Registry Settings is missing DEFAULT_PROJECT_CHANNEL.');

  logHub_('INFO', 'debugCheckHubConfiguration', '', 'Hub configuration preflight passed.', result);
  return JSON.stringify(result);
}

function debugValidateHubRegistryConnection() {
  debugCheckHubConfiguration();
  const eventKey = 'project.unexpected_status_change';
  const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  if (!event) throw new Error('Registry event is missing: ' + eventKey);

  const template = findTemplate_({
    'Queue ID': 'debug-registry-check',
    'Event Key': eventKey,
    'Payload JSON': stringifyJson_(buildHubSmokePayload_())
  });

  const result = {
    eventKey: eventKey,
    templateKey: template['Template Key'],
    channelType: template['Channel Type'],
    postMode: template['Post Mode'],
    sendRule: template['Default Send Rule']
  };
  logHub_('INFO', 'debugValidateHubRegistryConnection', '', 'Hub Registry connection validated.', result);
  return JSON.stringify(result);
}

function debugValidateHubSchemaV2() {
  const ss = SpreadsheetApp.getActive();
  const results = {};
  const legacyHeaders = {
    Queue: ['Lane', 'Priority', 'Slack Thread ID', 'Reviewer', 'Approver', 'Approved At', 'Sent At', 'Slack Channel', 'Slack Message TS', 'Slack Message URL', 'Parent Queue ID', 'Expected Previous Event Key', 'Path Override'],
    Review: ['Created At', 'Source', 'Lane', 'Event Key', 'Priority', 'Slack Message URL'],
    History: ['Dedupe Key', 'Created At', 'Updated At', 'Source', 'Lane', 'Status', 'Priority', 'Channel Override', 'Send Rule', 'Payload JSON', 'Reviewer', 'Approver', 'Approved At', 'Sent At', 'Parent Queue ID', 'Expected Previous Event Key', 'Path Override', 'Scheduled For'],
    Flow_State: ['Current Path', 'Allowed Sad Path Event Keys', 'Last Sent At', 'Payload JSON']
  };
  const hiddenSheets = [
    HUB.SHEETS.SKILL_RUN_LOG,
    HUB.SHEETS.GRAPH_ENTITIES,
    HUB.SHEETS.GRAPH_W_NODES,
    HUB.SHEETS.GRAPH_EDGES,
    HUB.SHEETS.GRAPH_EVENTS
  ];
  let ok = true;

  Object.keys(HUB.HEADERS).forEach(key => {
    const sheetName = HUB.SHEETS[key];
    if (!sheetName) return;
    const sheet = ss.getSheetByName(sheetName);
    const expected = HUB.HEADERS[key];
    const actual = sheet ? getHeaders_(sheet) : [];
    const missing = expected.filter(header => actual.indexOf(header) < 0);
    const legacy = (legacyHeaders[sheetName] || []).filter(header => actual.indexOf(header) >= 0);
    const expectedHidden = hiddenSheets.indexOf(sheetName) >= 0;
    const hidden = sheet ? sheet.isSheetHidden() : false;
    const visibilityOk = !sheet || hidden === expectedHidden;
    if (!sheet || missing.length || legacy.length || !visibilityOk) ok = false;
    results[sheetName] = {
      exists: Boolean(sheet),
      missing: missing,
      legacy: legacy,
      hidden: hidden,
      expectedHidden: expectedHidden
    };
  });

  const result = {
    ok: ok,
    sheets: results
  };
  logHub_(ok ? 'INFO' : 'ERROR', 'debugValidateHubSchemaV2', '', 'Hub v2 schema validation completed.', result);
  if (!ok) throw new Error('Hub v2 schema validation failed: ' + JSON.stringify(result));
  return JSON.stringify(result, null, 2);
}

function buildHubSmokeDraft_(sendRule) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const draft = {
    Source: 'Hub Debug',
    Lane: 'Project',
    'Event Key': 'project.unexpected_status_change',
    Status: HUB.STATUS.DRAFT,
    Priority: 'Low',
    Owner: 'Hub Smoke Test',
    'Flow ID': 'debug-hub-smoke-test',
    'Dedupe Key': 'debug|hub-smoke-test|' + stamp,
    'Payload JSON': stringifyJson_(buildHubSmokePayload_())
  };

  if (sendRule) draft['Send Rule'] = sendRule;
  return draft;
}

function buildHubSmokePayload_() {
  return {
    subject: 'Hub Smoke Test',
    owner: 'Hub Smoke Test',
    what: 'This is a controlled test of Hub queue processing.',
    so_what: 'It validates registry lookup, template variable validation, queue updates, history capture, and run logging.',
    whats_next: 'If this row logs successfully, run a Slack smoke test with a real channel when ready.'
  };
}

function findHistoryItemByQueueId_(queueId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.HISTORY);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const row = findRowByKey_(sheet, 'Queue ID', queueId);
  return row ? getRowObject_(sheet, row) : null;
}

function buildKernelSmokeGraphSummary_(flowId, queueId) {
  const entityId = graphBuildEntityId_(flowId);
  const entity = graphFindObjectByKey_(HUB.SHEETS.GRAPH_ENTITIES, 'Entity ID', entityId);
  const wNodes = getRecentSheetObjects_(HUB.SHEETS.GRAPH_W_NODES, 100);
  const events = getRecentSheetObjects_(HUB.SHEETS.GRAPH_EVENTS, 100);
  return {
    entityFound: Boolean(entity),
    wNodeCount: wNodes.filter(row => row['Entity ID'] === entityId).length,
    eventCount: events.filter(row => String(row['Queue ID']) === String(queueId)).length
  };
}

function buildKernelSmokeSkillSummary_(queueRunId, approveRunId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.SKILL_RUN_LOG);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Skill_Run_Log has no rows after kernel smoke test.');
  }

  const rows = getRecentSheetObjects_(HUB.SHEETS.SKILL_RUN_LOG, 100).filter(row =>
    row['Run ID'] === queueRunId ||
    row['Run ID'] === approveRunId ||
    row['Parent Run ID'] === queueRunId ||
    row['Parent Run ID'] === approveRunId
  );
  return {
    runCount: rows.length,
    errorCount: rows.filter(row => String(row.Status || '').toUpperCase() === 'ERROR').length,
    skillIds: rows.map(row => row['Skill ID']).filter((skillId, index, list) => list.indexOf(skillId) === index)
  };
}

function debugKernelSmokeCheckpoint_(queueId, message, details) {
  logHub_('INFO', 'debugRunKernelSmokeTestLogOnly', queueId || '', message, details || {});
}

function findRowByKey_(sheet, keyField, keyValue) {
  if (!sheet || !keyValue || sheet.getLastRow() < 2) return 0;
  const headers = getHeaders_(sheet);
  const keyIndex = headers.indexOf(keyField);
  if (keyIndex < 0) throw new Error(sheet.getName() + ' sheet is missing ' + keyField + ' header.');

  const values = sheet.getRange(2, keyIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(keyValue)) return i + 2;
  }
  return 0;
}

function getRecentSheetObjects_(sheetName, maxRows) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = getHeaders_(sheet);
  const rowCount = Math.min(sheet.getLastRow() - 1, maxRows || 100);
  return sheet.getRange(2, 1, rowCount, headers.length).getValues().map(rowValues =>
    headers.reduce((object, header, index) => {
      object[header] = rowValues[index];
      return object;
    }, {})
  );
}
