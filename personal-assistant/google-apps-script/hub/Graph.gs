const GRAPH_W_DIMENSIONS = ['Who', 'What', 'Where', 'When', 'Why'];

function setupGraphSheets_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = [
    ensureSheet_(ss, HUB.SHEETS.GRAPH_ENTITIES, HUB.HEADERS.GRAPH_ENTITIES),
    ensureSheet_(ss, HUB.SHEETS.GRAPH_W_NODES, HUB.HEADERS.GRAPH_W_NODES),
    ensureSheet_(ss, HUB.SHEETS.GRAPH_EDGES, HUB.HEADERS.GRAPH_EDGES),
    ensureSheet_(ss, HUB.SHEETS.GRAPH_EVENTS, HUB.HEADERS.GRAPH_EVENTS)
  ];

  sheets.forEach(sheet => {
    sheet.setFrozenRows(1);
    configureHubPlainTextColumns_(sheet);
    hideGraphSheet_(sheet);
  });
}

function graphRecordDraftSafe_(item, action) {
  graphBestEffort_(action || 'draft_recorded', item && item['Queue ID'], function() {
    graphRecordQueueItem_(item, action || 'draft_recorded', false);
  });
}

function graphRecordVerifiedQueueItemSafe_(item, action) {
  graphBestEffort_(action || 'verified_recorded', item && item['Queue ID'], function() {
    graphRecordQueueItem_(item, action || 'verified_recorded', true);
  });
}

function graphRecordDiscardSafe_(item, reason) {
  graphBestEffort_('discard_recorded', item && item['Queue ID'], function() {
    graphInsertEvent_(item, 'discarded', 'DISCARDED', {
      reason: reason || item.Error || '',
      payload: normalizePayload_(item)
    });
  });
}

function graphSyncFlowStateSafe_(flowState) {
  graphBestEffort_('flow_state_synced', flowState && flowState['Last Queue ID'], function() {
    graphSyncFlowState_(flowState);
  });
}

function exportGraphMemoryToDrive() {
  const folderId = getScriptProperty_('GRAPH_EXPORT_FOLDER_ID');
  if (!folderId) {
    logHub_('INFO', 'exportGraphMemoryToDrive', '', 'Skipped graph memory export because GRAPH_EXPORT_FOLDER_ID is not configured.', {});
    return {
      ok: true,
      skipped: true,
      message: 'GRAPH_EXPORT_FOLDER_ID is not configured.'
    };
  }

  const exportedAt = nowIso_();
  const graphData = {
    version: 1,
    exportedAt: exportedAt,
    source: 'Personal Assistant Hub',
    entities: getGraphObjects_(HUB.SHEETS.GRAPH_ENTITIES),
    wNodes: getGraphObjects_(HUB.SHEETS.GRAPH_W_NODES),
    edges: getGraphObjects_(HUB.SHEETS.GRAPH_EDGES),
    events: getGraphObjects_(HUB.SHEETS.GRAPH_EVENTS).map(graphEvent => ({
      graphEventId: graphEvent['Graph Event ID'],
      entityId: graphEvent['Entity ID'],
      flowId: graphEvent['Flow ID'],
      queueId: graphEvent['Queue ID'],
      eventKey: graphEvent['Event Key'],
      graphAction: graphEvent['Graph Action'],
      status: graphEvent.Status,
      payloadHash: graphEvent['Payload Hash'],
      createdAt: graphEvent['Created At']
    }))
  };
  const calibrationLog = {
    version: 1,
    exportedAt: exportedAt,
    corrections: [],
    biasRules: []
  };

  const folder = DriveApp.getFolderById(folderId);
  writeGraphJsonFile_(folder, 'graph_data.json', graphData);
  writeGraphJsonFile_(folder, 'calibration_log.json', calibrationLog);

  logHub_('INFO', 'exportGraphMemoryToDrive', '', 'Graph memory exported to Drive.', {
    folderId: folderId,
    entityCount: graphData.entities.length,
    wNodeCount: graphData.wNodes.length,
    edgeCount: graphData.edges.length,
    eventCount: graphData.events.length
  });
  return {
    ok: true,
    skipped: false,
    exportedAt: exportedAt,
    entityCount: graphData.entities.length,
    wNodeCount: graphData.wNodes.length,
    edgeCount: graphData.edges.length,
    eventCount: graphData.events.length
  };
}

function graphRecordQueueItem_(item, action, verified) {
  if (!item || !item['Flow ID']) return;

  const entity = graphUpsertEntityFromItem_(item, verified);
  const entityNodeId = entity['Entity ID'];
  const payload = normalizePayload_(item);
  const wValues = graphExtractWValues_(item, payload);

  GRAPH_W_DIMENSIONS.forEach(dimension => {
    const wNode = graphUpsertWNode_(item, entityNodeId, dimension, wValues[dimension] || '', verified);
    graphUpsertEdge_({
      'Edge ID': graphBuildEdgeId_(entityNodeId, wNode['W Node ID'], 'HAS_W_NODE'),
      'Source Node ID': entityNodeId,
      'Target Node ID': wNode['W Node ID'],
      'Relationship Type': 'HAS_W_NODE',
      Status: 'ACTIVE',
      Confidence: verified && wValues[dimension] ? 1 : '',
      'Source Queue ID': item['Queue ID'] || '',
      'Source Event Key': item['Event Key'] || ''
    });
  });

  if (item['Queue ID']) {
    graphUpsertEdge_({
      'Edge ID': graphBuildEdgeId_(entityNodeId, graphBuildQueueNodeId_(item['Queue ID']), 'HAS_QUEUE_ITEM'),
      'Source Node ID': entityNodeId,
      'Target Node ID': graphBuildQueueNodeId_(item['Queue ID']),
      'Relationship Type': 'HAS_QUEUE_ITEM',
      Status: verified ? 'VERIFIED' : 'PENDING',
      Confidence: verified ? 1 : '',
      'Source Queue ID': item['Queue ID'],
      'Source Event Key': item['Event Key'] || ''
    });
  }

  if (item['Event Key']) {
    graphUpsertEdge_({
      'Edge ID': graphBuildEdgeId_(entityNodeId, graphBuildEventNodeId_(item['Event Key']), 'HAS_EVENT'),
      'Source Node ID': entityNodeId,
      'Target Node ID': graphBuildEventNodeId_(item['Event Key']),
      'Relationship Type': 'HAS_EVENT',
      Status: verified ? 'VERIFIED' : 'PENDING',
      Confidence: verified ? 1 : '',
      'Source Queue ID': item['Queue ID'] || '',
      'Source Event Key': item['Event Key']
    });
  }

  graphInsertEvent_(item, action, verified ? 'VERIFIED' : 'PENDING', {
    wValues: wValues,
    payload: payload
  });
}

function graphSyncFlowState_(flowState) {
  if (!flowState || !flowState['Flow ID']) return;

  const entityId = graphBuildEntityId_(flowState['Flow ID']);
  const existing = graphFindObjectByKey_(HUB.SHEETS.GRAPH_ENTITIES, 'Entity ID', entityId) || {};
  const entity = Object.assign({}, existing, {
    'Entity ID': entityId,
    'Flow ID': flowState['Flow ID'],
    'Entity Type': flowState['Flow Type'] || existing['Entity Type'] || '',
    Subject: flowState.Subject || existing.Subject || flowState['Flow ID'],
    Owner: flowState.Owner || existing.Owner || '',
    'Current Event Key': flowState['Current Event Key'] || existing['Current Event Key'] || '',
    'Current Path': flowState['Current Path'] || existing['Current Path'] || '',
    'Current Status': flowState['Flow Status'] || existing['Current Status'] || '',
    'Slack Channel': flowState['Slack Channel'] || existing['Slack Channel'] || '',
    'Anchor Message TS': flowState['Anchor Message TS'] || existing['Anchor Message TS'] || '',
    'Thread TS': flowState['Thread TS'] || existing['Thread TS'] || '',
    'Latest Reply TS': flowState['Latest Reply TS'] || existing['Latest Reply TS'] || '',
    'Anchor Message URL': flowState['Anchor Message URL'] || existing['Anchor Message URL'] || '',
    'Latest Queue ID': flowState['Last Queue ID'] || existing['Latest Queue ID'] || '',
    'Last Confirmed Update At': flowState['Last Sent At'] || existing['Last Confirmed Update At'] || '',
    'Payload JSON': flowState['Payload JSON'] || existing['Payload JSON'] || '',
    'Updated At': nowIso_()
  });
  graphUpsertByKey_(HUB.SHEETS.GRAPH_ENTITIES, HUB.HEADERS.GRAPH_ENTITIES, 'Entity ID', entity);

  if (flowState['Slack Channel'] && flowState['Anchor Message TS']) {
    graphUpsertEdge_({
      'Edge ID': graphBuildEdgeId_(entityId, graphBuildSlackNodeId_(flowState['Slack Channel'], flowState['Anchor Message TS']), 'HAS_SLACK_ANCHOR'),
      'Source Node ID': entityId,
      'Target Node ID': graphBuildSlackNodeId_(flowState['Slack Channel'], flowState['Anchor Message TS']),
      'Relationship Type': 'HAS_SLACK_ANCHOR',
      Status: 'ACTIVE',
      Confidence: 1,
      'Source Queue ID': flowState['Last Queue ID'] || '',
      'Source Event Key': flowState['Current Event Key'] || ''
    });
  }

  if (flowState['Slack Channel'] && flowState['Thread TS']) {
    graphUpsertEdge_({
      'Edge ID': graphBuildEdgeId_(entityId, graphBuildSlackThreadNodeId_(flowState['Slack Channel'], flowState['Thread TS']), 'HAS_SLACK_THREAD'),
      'Source Node ID': entityId,
      'Target Node ID': graphBuildSlackThreadNodeId_(flowState['Slack Channel'], flowState['Thread TS']),
      'Relationship Type': 'HAS_SLACK_THREAD',
      Status: 'ACTIVE',
      Confidence: 1,
      'Source Queue ID': flowState['Last Queue ID'] || '',
      'Source Event Key': flowState['Current Event Key'] || ''
    });
  }
}

function graphUpsertEntityFromItem_(item, confirmed) {
  const entityId = graphBuildEntityId_(item['Flow ID']);
  const existing = graphFindObjectByKey_(HUB.SHEETS.GRAPH_ENTITIES, 'Entity ID', entityId) || {};
  const payload = normalizePayload_(item);
  const subject = graphBuildSubject_(item, payload);
  const entity = Object.assign({}, existing, {
    'Entity ID': entityId,
    'Flow ID': item['Flow ID'],
    'Entity Type': item.Lane || existing['Entity Type'] || inferLaneFromEventKey_(item['Event Key']),
    Subject: subject || existing.Subject || item['Flow ID'],
    Owner: item.Owner || payload.owner || existing.Owner || '',
    'Slack Channel': item['Slack Channel'] || existing['Slack Channel'] || '',
    'Anchor Message TS': item['Slack Thread ID'] || existing['Anchor Message TS'] || '',
    'Thread TS': item['Slack Thread ID'] || existing['Thread TS'] || '',
    'Latest Reply TS': item['Slack Message TS'] || existing['Latest Reply TS'] || '',
    'Anchor Message URL': item['Slack Message URL'] || existing['Anchor Message URL'] || '',
    'Latest Queue ID': item['Queue ID'] || existing['Latest Queue ID'] || '',
    'Updated At': nowIso_()
  });

  if (confirmed || !existing['Current Event Key']) {
    entity['Current Event Key'] = item['Event Key'] || existing['Current Event Key'] || '';
    entity['Current Path'] = item['Path Override'] || existing['Current Path'] || '';
    entity['Current Status'] = item.Status || existing['Current Status'] || '';
  }

  if (confirmed) {
    entity['Last Confirmed Update At'] = item['Sent At'] || item['Approved At'] || nowIso_();
    entity['Payload JSON'] = item['Payload JSON'] || stringifyJson_(payload);
  } else {
    entity['Last Confirmed Update At'] = existing['Last Confirmed Update At'] || '';
    entity['Payload JSON'] = existing['Payload JSON'] || '';
  }

  graphUpsertByKey_(HUB.SHEETS.GRAPH_ENTITIES, HUB.HEADERS.GRAPH_ENTITIES, 'Entity ID', entity);
  return entity;
}

function graphUpsertWNode_(item, entityId, dimension, value, verified) {
  const wNodeId = graphBuildWNodeId_(item['Flow ID'], dimension);
  const existing = graphFindObjectByKey_(HUB.SHEETS.GRAPH_W_NODES, 'W Node ID', wNodeId) || {};
  const existingVerified = String(existing.Status || '') === 'VERIFIED';
  const shouldUpdateActual = verified || !existingVerified;
  const status = verified && value ? 'VERIFIED' : (existing.Status || 'PENDING');
  const wNode = Object.assign({}, existing, {
    'W Node ID': wNodeId,
    'Entity ID': entityId,
    'Flow ID': item['Flow ID'],
    Dimension: dimension,
    Status: status,
    'User Actual': shouldUpdateActual ? value : existing['User Actual'] || '',
    'AI Guess': existing['AI Guess'] || '',
    Confidence: verified && value ? 1 : existing.Confidence || '',
    Rationale: existing.Rationale || '',
    'Source Queue ID': item['Queue ID'] || existing['Source Queue ID'] || '',
    'Source Event Key': item['Event Key'] || existing['Source Event Key'] || '',
    'Verified At': verified && value ? nowIso_() : existing['Verified At'] || '',
    'Updated At': nowIso_()
  });
  graphUpsertByKey_(HUB.SHEETS.GRAPH_W_NODES, HUB.HEADERS.GRAPH_W_NODES, 'W Node ID', wNode);
  return wNode;
}

function graphUpsertEdge_(edge) {
  const existing = graphFindObjectByKey_(HUB.SHEETS.GRAPH_EDGES, 'Edge ID', edge['Edge ID']) || {};
  graphUpsertByKey_(HUB.SHEETS.GRAPH_EDGES, HUB.HEADERS.GRAPH_EDGES, 'Edge ID', Object.assign({}, existing, edge, {
    'Created At': existing['Created At'] || nowIso_(),
    'Updated At': nowIso_()
  }));
}

function graphInsertEvent_(item, action, status, observation) {
  const payload = normalizePayload_(item || {});
  const observationJson = stringifyJson_(observation || {});
  insertObjectRowAtTop_(ensureGraphSheet_(HUB.SHEETS.GRAPH_EVENTS, HUB.HEADERS.GRAPH_EVENTS), {
    'Graph Event ID': uuid_(),
    'Entity ID': item && item['Flow ID'] ? graphBuildEntityId_(item['Flow ID']) : '',
    'Flow ID': item && item['Flow ID'] || '',
    'Queue ID': item && item['Queue ID'] || '',
    'Event Key': item && item['Event Key'] || payload.event_key || '',
    'Graph Action': action,
    Status: status || '',
    'Payload Hash': graphHashString_(item && item['Payload JSON'] || stringifyJson_(payload)),
    'Observation JSON': observationJson,
    'Created At': nowIso_()
  });
}

function graphUpsertByKey_(sheetName, headers, keyField, object) {
  const sheet = ensureGraphSheet_(sheetName, headers);
  const row = graphFindRowByKey_(sheet, keyField, object[keyField]);
  if (row) {
    updateRowFields_(sheet, row, object);
    return row;
  }

  insertObjectRowAtTop_(sheet, object);
  return 2;
}

function ensureGraphSheet_(sheetName, headers) {
  const sheet = ensureSheet_(SpreadsheetApp.getActive(), sheetName, headers);
  configureHubPlainTextColumns_(sheet);
  return sheet;
}

function graphFindObjectByKey_(sheetName, keyField, keyValue) {
  if (!keyValue) return null;
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return null;
  return getObjects_(sheet).find(row => String(row[keyField]) === String(keyValue)) || null;
}

function graphFindRowByKey_(sheet, keyField, keyValue) {
  if (!sheet || !keyValue || sheet.getLastRow() < 2) return 0;
  const headers = getHeaders_(sheet);
  const keyIndex = headers.indexOf(keyField);
  if (keyIndex < 0) throw new Error(sheet.getName() + ' sheet is missing ' + keyField + ' header.');

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][keyIndex]) === String(keyValue)) return i + 2;
  }
  return 0;
}

function getGraphObjects_(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  return getObjects_(sheet);
}

function graphExtractWValues_(item, payload) {
  return {
    Who: String(payload.owner || item.Owner || ''),
    What: String(payload.what || payload.status || payload.reason || ''),
    Where: String(payload.where || payload.destination || payload.environment || item['Slack Channel'] || ''),
    When: String(payload.when || payload.release_date || payload.target_date || item['Scheduled For'] || ''),
    Why: String(payload.so_what || payload.impact || payload.reason || '')
  };
}

function graphBuildSubject_(item, payload) {
  return payload.subject ||
    payload.project ||
    payload.release_name ||
    payload.issue_title ||
    payload.release_id ||
    item['Flow ID'] ||
    '';
}

function graphBuildEntityId_(flowId) {
  return 'entity:' + String(flowId || '');
}

function graphBuildWNodeId_(flowId, dimension) {
  return 'w:' + String(flowId || '') + ':' + normalizeHubKey_(dimension);
}

function graphBuildQueueNodeId_(queueId) {
  return 'queue:' + String(queueId || '');
}

function graphBuildEventNodeId_(eventKey) {
  return 'event:' + String(eventKey || '');
}

function graphBuildSlackNodeId_(channel, ts) {
  return 'slack-message:' + String(channel || '') + ':' + String(ts || '');
}

function graphBuildSlackThreadNodeId_(channel, ts) {
  return 'slack-thread:' + String(channel || '') + ':' + String(ts || '');
}

function graphBuildEdgeId_(sourceNodeId, targetNodeId, relationshipType) {
  return 'edge:' + normalizeHubKey_(relationshipType) + ':' + graphHashString_([sourceNodeId, targetNodeId, relationshipType].join('|'));
}

function graphHashString_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''));
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function hideGraphSheet_(sheet) {
  try {
    sheet.hideSheet();
  } catch (error) {
    logHub_('WARN', 'hideGraphSheet_', '', 'Skipped hiding graph sheet.', {
      sheet: sheet.getName(),
      error: error.message || String(error)
    });
  }
}

function writeGraphJsonFile_(folder, fileName, data) {
  const content = JSON.stringify(data, null, 2);
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    files.next().setContent(content);
    return;
  }
  folder.createFile(fileName, content, 'application/json');
}

function graphBestEffort_(fn, queueId, callback) {
  try {
    callback();
  } catch (error) {
    logHub_('WARN', fn, queueId || '', 'Graph memory write skipped; primary workflow continues.', {
      error: error.message || String(error),
      stack: error.stack || ''
    });
  }
}
