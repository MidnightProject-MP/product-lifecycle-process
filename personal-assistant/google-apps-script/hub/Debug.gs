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
  debugCheckHubConfiguration();
  const draft = buildHubSmokeDraft_('Log Only');
  draft['Flow ID'] = 'debug-kernel-smoke-test';
  draft['Dedupe Key'] = 'debug|kernel-smoke-test|' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  const queueRun = runSkill('queue_communication_draft', {
    draft: draft
  });
  if (!queueRun.ok) throw new Error('queue_communication_draft failed: ' + queueRun.error.message);

  const queueId = queueRun.output.queueId;
  const approveRun = runSkill('approve_draft', {
    queueId: queueId
  }, { parentRunId: queueRun.runId });
  if (!approveRun.ok) throw new Error('approve_draft failed: ' + approveRun.error.message);

  const historyItem = findHistoryItemByQueueId_(queueId);
  if (!historyItem || historyItem.Status !== HUB.STATUS.LOGGED) {
    throw new Error('Kernel smoke test did not log History correctly. History status is: ' + (historyItem ? historyItem.Status : 'missing') + '.');
  }

  const flow = findFlowStateByFlowId_(draft['Flow ID']);
  if (!flow || flow['Last Queue ID'] !== queueId) {
    throw new Error('Kernel smoke test did not update Flow_State for Queue ID: ' + queueId);
  }

  const graphSummary = buildKernelSmokeGraphSummary_(draft['Flow ID'], queueId);
  if (!graphSummary.entityFound || graphSummary.wNodeCount < GRAPH_W_DIMENSIONS.length || graphSummary.eventCount < 1) {
    throw new Error('Kernel smoke test did not record expected graph memory: ' + JSON.stringify(graphSummary));
  }

  const skillSummary = buildKernelSmokeSkillSummary_(queueRun.runId, approveRun.runId);
  if (skillSummary.errorCount > 0) {
    throw new Error('Kernel smoke test found Skill_Run_Log errors: ' + JSON.stringify(skillSummary));
  }

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
  return getObjects_(sheet).find(row => String(row['Queue ID']) === String(queueId)) || null;
}

function buildKernelSmokeGraphSummary_(flowId, queueId) {
  const entityId = graphBuildEntityId_(flowId);
  const entity = graphFindObjectByKey_(HUB.SHEETS.GRAPH_ENTITIES, 'Entity ID', entityId);
  return {
    entityFound: Boolean(entity),
    wNodeCount: getGraphObjects_(HUB.SHEETS.GRAPH_W_NODES).filter(row => row['Entity ID'] === entityId).length,
    eventCount: getGraphObjects_(HUB.SHEETS.GRAPH_EVENTS).filter(row => String(row['Queue ID']) === String(queueId)).length
  };
}

function buildKernelSmokeSkillSummary_(queueRunId, approveRunId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.SKILL_RUN_LOG);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Skill_Run_Log has no rows after kernel smoke test.');
  }

  const rows = getObjects_(sheet).filter(row =>
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
