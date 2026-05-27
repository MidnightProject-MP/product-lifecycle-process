const SKILL_CATALOG = {
  queue_communication_draft: skillContract_(
    'queue_communication_draft',
    'Create or dedupe a communication draft in Queue.',
    handleQueueCommunicationDraftSkill_
  ),
  save_review_draft: skillContract_(
    'save_review_draft',
    'Save Communication Console draft edits back to Queue.',
    handleSaveReviewDraftSkill_
  ),
  approve_draft: skillContract_(
    'approve_draft',
    'Approve and process an existing Queue draft.',
    handleApproveDraftSkill_
  ),
  discard_draft: skillContract_(
    'discard_draft',
    'Discard an existing Queue draft and archive it to History.',
    handleDiscardDraftSkill_
  ),
  resolve_template_policy: skillContract_(
    'resolve_template_policy',
    'Resolve Registry event/template policy for a Queue item.',
    handleResolveTemplatePolicySkill_
  ),
  validate_template_variables: skillContract_(
    'validate_template_variables',
    'Validate required template variables for a Queue item.',
    handleValidateTemplateVariablesSkill_
  ),
  render_anchor_message: skillContract_(
    'render_anchor_message',
    'Render the Slack anchor text for a Queue item.',
    handleRenderAnchorMessageSkill_
  ),
  render_thread_reply: skillContract_(
    'render_thread_reply',
    'Render the Slack thread reply text for a Queue item.',
    handleRenderThreadReplySkill_
  ),
  resolve_slack_target: skillContract_(
    'resolve_slack_target',
    'Resolve Slack channel, thread timestamp, and reply policy.',
    handleResolveSlackTargetSkill_
  ),
  post_slack_message: skillContract_(
    'post_slack_message',
    'Post a message to Slack.',
    handlePostSlackMessageSkill_
  ),
  send_test_slack_message: skillContract_(
    'send_test_slack_message',
    'Post a draft to the test Slack channel without consuming the Queue row.',
    handleSendTestSlackMessageSkill_
  ),
  update_slack_anchor: skillContract_(
    'update_slack_anchor',
    'Update an existing Slack anchor message when policy allows.',
    handleUpdateSlackAnchorSkill_
  ),
  record_history: skillContract_(
    'record_history',
    'Copy a Queue row into History.',
    handleRecordHistorySkill_
  ),
  advance_flow_state: skillContract_(
    'advance_flow_state',
    'Record the current parent flow state after send/log.',
    handleAdvanceFlowStateSkill_
  ),
  schedule_next_flow_draft: skillContract_(
    'schedule_next_flow_draft',
    'Schedule the next happy-path flow draft when Registry policy allows.',
    handleScheduleNextFlowDraftSkill_
  ),
  record_graph_memory: skillContract_(
    'record_graph_memory',
    'Record passive graph memory for draft, send, log, discard, or flow sync.',
    handleRecordGraphMemorySkill_
  ),
  export_graph_memory_snapshot: skillContract_(
    'export_graph_memory_snapshot',
    'Export graph memory JSON files to Drive when configured.',
    handleExportGraphMemorySnapshotSkill_
  ),
  resolve_graph_context: skillContract_(
    'resolve_graph_context',
    'Load graph entity, W-node, edge, and event context for a flow.',
    handleResolveGraphContextSkill_
  ),
  analyze_review_completeness: skillContract_(
    'analyze_review_completeness',
    'Analyze draft completeness against W-graph context.',
    handleAnalyzeReviewCompletenessSkill_
  ),
  build_review_guidance: skillContract_(
    'build_review_guidance',
    'Build advisory review guidance from graph context and draft content.',
    handleBuildReviewGuidanceSkill_
  ),
  check_graph_health: skillContract_(
    'check_graph_health',
    'Check passive graph memory health and orphan records.',
    handleCheckGraphHealthSkill_
  ),
  backfill_graph_from_history: skillContract_(
    'backfill_graph_from_history',
    'Backfill passive graph memory from existing History and Flow_State.',
    handleBackfillGraphFromHistorySkill_
  ),
  append_unified_event: skillContract_(
    'append_unified_event',
    'Append a deduped, locked event to the Unified Event Log.',
    handleAppendUnifiedEventSkill_
  ),
  sensor_slack_scan_delta: skillContract_(
    'sensor_slack_scan_delta',
    'Process raw Slack inbox rows into normalized source events.',
    handleSensorSlackScanDeltaSkill_
  ),
  run_essential_milestone_audit: skillContract_(
    'run_essential_milestone_audit',
    'Audit a known milestone against narrowed source evidence.',
    handleRunEssentialMilestoneAuditSkill_
  ),
  reconcile_alignment_events: skillContract_(
    'reconcile_alignment_events',
    'Create PM-reviewable Alignment Risks from processed evidence events.',
    handleReconcileAlignmentEventsSkill_
  ),
  rollup_project_history: skillContract_(
    'rollup_project_history',
    'Roll up processed trust-layer events into Project History and prune safe raw rows.',
    handleRollupProjectHistorySkill_
  )
};

function setupSkillSheets_() {
  const sheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.SKILL_RUN_LOG, HUB.HEADERS.SKILL_RUN_LOG);
  sheet.setFrozenRows(1);
  configureHubPlainTextColumns_(sheet);
  try {
    sheet.hideSheet();
  } catch (error) {
    logHub_('WARN', 'setupSkillSheets_', '', 'Skipped hiding Skill_Run_Log.', {
      error: error.message || String(error)
    });
  }
}

function runSkill(skillId, input, options) {
  const startedAt = nowIso_();
  const startedMs = Date.now();
  const runId = options && options.runId ? options.runId : uuid_();
  const parentRunId = options && options.parentRunId ? options.parentRunId : '';
  const contract = SKILL_CATALOG[skillId];
  const envelope = {
    ok: false,
    skillId: skillId,
    runId: runId,
    startedAt: startedAt,
    completedAt: '',
    output: null,
    error: null
  };

  try {
    if (!contract) throw new Error('Unknown skill: ' + skillId);
    envelope.output = contract.handler(input || {}, {
      runId: runId,
      parentRunId: parentRunId,
      skillId: skillId,
      options: options || {}
    });
    envelope.ok = true;
    return envelope;
  } catch (error) {
    envelope.error = {
      message: error.message || String(error),
      stack: error.stack || ''
    };
    if (options && options.throwOnError) {
      throw error;
    }
    return envelope;
  } finally {
    envelope.completedAt = nowIso_();
    logSkillRunSafe_(envelope, input || {}, parentRunId, Date.now() - startedMs);
  }
}

function runSkillOrThrow_(skillId, input, options) {
  const envelope = runSkill(skillId, input, Object.assign({}, options || {}, { throwOnError: false }));
  if (!envelope.ok) {
    throw new Error(envelope.error && envelope.error.message ? envelope.error.message : 'Skill failed: ' + skillId);
  }
  return envelope.output;
}

function debugRunSkill(skillId, inputJson) {
  const input = inputJson ? JSON.parse(String(inputJson)) : {};
  return JSON.stringify(runSkill(skillId, input), null, 2);
}

function debugListSkills() {
  return JSON.stringify(Object.keys(SKILL_CATALOG).map(skillId => {
    const contract = SKILL_CATALOG[skillId];
    return {
      skillId: skillId,
      purpose: contract.purpose
    };
  }), null, 2);
}

function debugCheckGraphHealthSkill() {
  return JSON.stringify(runSkill('check_graph_health', {}), null, 2);
}

function debugBackfillGraphFromHistorySkill() {
  return JSON.stringify(runSkill('backfill_graph_from_history', {}), null, 2);
}

function debugExportGraphMemorySkill() {
  return JSON.stringify(runSkill('export_graph_memory_snapshot', {}), null, 2);
}

function skillContract_(skillId, purpose, handler) {
  return {
    skillId: skillId,
    purpose: purpose,
    handler: handler
  };
}

function logSkillRunSafe_(envelope, input, parentRunId, durationMs) {
  const rowObject = {
    'Run ID': envelope.runId,
    Timestamp: new Date(),
    'Skill ID': envelope.skillId,
    'Parent Run ID': parentRunId || '',
    Status: envelope.ok ? 'OK' : 'ERROR',
    'Input Hash': skillHash_(JSON.stringify(input || {})),
    'Output Summary': summarizeSkillOutput_(envelope.output),
    Error: envelope.error ? envelope.error.message : '',
    'Duration Ms': durationMs
  };

  if (isHubLogBuffering_()) {
    bufferSkillRunLogObject_(rowObject);
    return;
  }

  try {
    writeSkillRunLogObjects_([rowObject]);
  } catch (error) {
    console.log(JSON.stringify({
      level: 'WARN',
      functionName: 'logSkillRunSafe_',
      message: 'Failed to write Skill_Run_Log.',
      details: {
        skillId: envelope.skillId,
        runId: envelope.runId,
        error: error.message || String(error)
      }
    }));
  }
}

function writeSkillRunLogObjects_(objects) {
  const rows = objects || [];
  if (!rows.length) return;
  const sheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.SKILL_RUN_LOG, HUB.HEADERS.SKILL_RUN_LOG);
  const headers = getHeaders_(sheet);
  insertValuesRowsAtTop_(sheet, rows.slice().reverse().map(rowObject =>
    headers.map(header => normalizeHubCellValue_(header, rowObject[header]))
  ));
}

function summarizeSkillOutput_(output) {
  if (output == null) return '';
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  return text.length > 500 ? text.slice(0, 497) + '...' : text;
}

function skillHash_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''));
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function handleQueueCommunicationDraftSkill_(input) {
  return {
    queueId: insertQueueDraftAtTop_(input.draft || input)
  };
}

function handleSaveReviewDraftSkill_(input, context) {
  const queueId = input.queueId;
  const resolved = resolveReviewControllerSelection_(queueId);
  const savedQueueId = updateQueueDraftFromReviewControllerForm_(resolved.queueSheet, resolved.row, input.form || input || {});
  const currentRow = findQueueRowByQueueId_(resolved.queueSheet, savedQueueId);
  if (currentRow) {
    runSkill('record_graph_memory', {
      action: 'draft_saved',
      item: getRowObject_(resolved.queueSheet, currentRow)
    }, { parentRunId: context.runId });
  }
  syncReviewSheetFromQueueSafe_();
  logHub_('INFO', 'save_review_draft', savedQueueId, 'Saved draft changes.', {});
  return {
    queueId: savedQueueId,
    row: currentRow || resolved.row
  };
}

function handleApproveDraftSkill_(input, context) {
  const queueSheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const resolved = input.row ? { queueSheet: queueSheet, row: input.row } : resolveReviewControllerSelection_(input.queueId);
  const row = resolved.row;
  const startingItem = getRowObject_(queueSheet, row);
  const startingQueueId = startingItem['Queue ID'];
  if (!startingQueueId) throw new Error('Queue row is missing Queue ID.');
  const queueId = input.form ? updateQueueDraftFromReviewControllerForm_(queueSheet, row, input.form || {}) : startingQueueId;
  const currentRow = input.form ? findQueueRowByQueueId_(queueSheet, queueId) : row;
  if (!currentRow) throw new Error('Queue row disappeared before approval: ' + queueId);

  updateRowFields_(queueSheet, currentRow, {
    Status: HUB.STATUS.APPROVED,
    'Approved At': nowIso_(),
    'Updated At': nowIso_(),
    Error: ''
  });
  logHub_('INFO', 'approve_draft', queueId, 'Approved draft for processing.', {});
  sendApprovedQueueRow_(queueSheet, currentRow, context.runId);

  const remainingRow = findQueueRowByQueueId_(queueSheet, queueId);
  if (remainingRow) {
    const remainingItem = getRowObject_(queueSheet, remainingRow);
    if (remainingItem.Status === HUB.STATUS.ERROR) {
      throw new Error(remainingItem.Error || 'Send failed. Check Run_Log for details.');
    }
  }

  return {
    queueId: queueId,
    status: 'Processed'
  };
}

function handleDiscardDraftSkill_(input) {
  const queueSheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const resolved = input.row ? { queueSheet: queueSheet, row: input.row } : resolveReviewControllerSelection_(input.queueId);
  const row = resolved.row;
  const item = getRowObject_(queueSheet, row);
  const queueId = item['Queue ID'];
  if (!queueId) throw new Error('Queue row is missing Queue ID.');

  archiveAndDeleteQueueRow_(queueSheet, row, HUB.STATUS.DISCARDED, input.reason || 'Discarded.');
  syncReviewSheetFromQueueSafe_();
  logHub_('INFO', 'discard_draft', queueId, 'Discarded draft.', {
    reason: input.reason || 'Discarded.'
  });
  return {
    queueId: queueId,
    status: HUB.STATUS.DISCARDED
  };
}

function handleResolveTemplatePolicySkill_(input) {
  const item = input.item || {};
  const template = findTemplate_(item);
  return {
    template: template,
    templateKey: template['Template Key'],
    postMode: template['Post Mode'],
    channelType: template['Channel Type'],
    defaultSendRule: template['Default Send Rule'],
    anchorUpdatePolicy: template['Anchor Update Policy'] || '',
    threadReplyPolicy: template['Thread Reply Policy'] || '',
    replyBroadcast: template['Reply Broadcast'] || ''
  };
}

function handleValidateTemplateVariablesSkill_(input) {
  validateRequiredTemplateVariables_(input.template || {}, input.item || {});
  return {
    valid: true
  };
}

function handleRenderAnchorMessageSkill_(input) {
  const item = input.item || {};
  const text = hasFinalMessageOverride_(item) ?
    renderFinalAnchorMessage_(item) :
    renderTemplate_(getTemplateAnchorText_(input.template || {}), item);
  return {
    text: text,
    finalMessageOverride: hasFinalMessageOverride_(item),
    textLength: String(text || '').length
  };
}

function handleRenderThreadReplySkill_(input) {
  const template = input.template || {};
  const item = input.item || {};
  const existingFlow = input.existingFlow || null;
  if (hasFinalMessageOverride_(item)) {
    const text = renderFinalThreadReply_(item);
    return {
      text: text,
      finalMessageOverride: true,
      textLength: String(text || '').length
    };
  }

  const registryReplyText = renderTemplate_(getTemplateReplyText_(template), item);
  const fallbackLabel = existingFlow ? 'Update' : 'Initial update';
  const text = String(registryReplyText || '').trim() || buildThreadHistoryText_(item, template, fallbackLabel);
  return {
    text: text,
    textLength: String(text || '').length
  };
}

function handleResolveSlackTargetSkill_(input) {
  const template = input.template || {};
  const item = input.item || {};
  const channel = item['Channel Override'] || resolveDefaultChannel_(template['Channel Type']);
  const threadTs = resolveThreadTsForSend_(template, item, input.existingFlow || null);
  return {
    channel: channel,
    threadTs: threadTs,
    shouldPostReply: shouldReplyInThread_(template, item),
    shouldBroadcastReply: Boolean(threadTs && shouldReplyInThread_(template, item) && shouldBroadcastThreadReply_(template, item))
  };
}

function handlePostSlackMessageSkill_(input) {
  const result = postSlackMessage_(input.channel, input.text, input.threadTs || '', Boolean(input.replyBroadcast));
  return result;
}

function handleSendTestSlackMessageSkill_(input, context) {
  const queueId = input.queueId || input['Queue ID'] || '';
  if (!queueId) throw new Error('Missing queueId for test Slack send.');
  return sendQueueDraftTestToSlack_(queueId, {
    source: input.source || 'skill',
    parentRunId: context.runId
  });
}

function handleUpdateSlackAnchorSkill_(input) {
  return updateSlackAnchorIfNeeded_(input.flow || null, input.text || '', input.item || {}, input.template || {}) || {};
}

function handleRecordHistorySkill_(input) {
  const queueSheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  if (!queueSheet) throw new Error('Queue sheet is missing.');
  const row = input.row || findQueueRowByQueueId_(queueSheet, input.queueId);
  if (!row) throw new Error('Queue row not found for Queue ID: ' + input.queueId);
  insertHistoryFromQueueRowAtTop_(queueSheet, row, input.item || null);
  return {
    recorded: true,
    queueId: input.queueId || getRowObject_(queueSheet, row)['Queue ID']
  };
}

function handleAdvanceFlowStateSkill_(input) {
  recordFlowStateAfterSend_(input.item || {}, input.template || {}, input.sendResult || null, input.previousFlow || null);
  return {
    flowId: input.item && input.item['Flow ID'] || ''
  };
}

function handleScheduleNextFlowDraftSkill_(input) {
  return {
    queueId: createNextScheduledDraftIfNeeded_(input.item || {})
  };
}

function handleRecordGraphMemorySkill_(input) {
  const action = input.action || 'draft_recorded';
  if (!isGraphMemoryEnabled_()) {
    return {
      recorded: false,
      skipped: true,
      action: action,
      reason: 'ENABLE_PASSIVE_GRAPH_MEMORY is not enabled.'
    };
  }

  if (action === 'verified' || action === 'sent_verified' || action === 'logged_verified') {
    graphRecordVerifiedQueueItemSafe_(input.item || {}, action);
  } else if (action === 'discarded' || action === 'discard_recorded') {
    graphRecordDiscardSafe_(input.item || {}, input.reason || '');
  } else if (action === 'flow_state_synced') {
    graphSyncFlowStateSafe_(input.flowState || {});
  } else {
    graphRecordDraftSafe_(input.item || {}, action);
  }
  return {
    recorded: true,
    action: action
  };
}

function handleExportGraphMemorySnapshotSkill_() {
  return exportGraphMemoryToDrive();
}

function handleResolveGraphContextSkill_(input) {
  if (!isGraphMemoryEnabled_()) {
    return {
      flowId: input.flowId || (input.item && input.item['Flow ID']) || '',
      entityId: '',
      entity: null,
      wNodes: [],
      edges: [],
      events: [],
      skipped: true,
      reason: 'ENABLE_PASSIVE_GRAPH_MEMORY is not enabled.'
    };
  }

  const flowId = input.flowId || (input.item && input.item['Flow ID']) || '';
  if (!flowId) throw new Error('Missing flowId.');
  const entityId = graphBuildEntityId_(flowId);
  return {
    flowId: flowId,
    entityId: entityId,
    entity: graphFindObjectByKey_(HUB.SHEETS.GRAPH_ENTITIES, 'Entity ID', entityId) || null,
    wNodes: getGraphObjects_(HUB.SHEETS.GRAPH_W_NODES).filter(row => row['Entity ID'] === entityId),
    edges: getGraphObjects_(HUB.SHEETS.GRAPH_EDGES).filter(row => row['Source Node ID'] === entityId || row['Target Node ID'] === entityId),
    events: getGraphObjects_(HUB.SHEETS.GRAPH_EVENTS).filter(row => row['Entity ID'] === entityId).slice(0, 10)
  };
}

function handleAnalyzeReviewCompletenessSkill_(input) {
  const item = input.item || {};
  const payload = normalizePayload_(item);
  const context = input.graphContext || {};
  const wValues = graphExtractWValues_(item, payload);
  const missing = [];
  Object.keys(wValues).forEach(dimension => {
    if (!String(wValues[dimension] || '').trim()) missing.push(dimension);
  });

  const warnings = [];
  const verifiedByDimension = {};
  (context.wNodes || []).forEach(node => {
    if (node.Status === 'VERIFIED') verifiedByDimension[node.Dimension] = node['User Actual'];
  });
  if (verifiedByDimension.Who && wValues.Who && verifiedByDimension.Who !== wValues.Who) {
    warnings.push('Owner differs from last verified graph memory.');
  }
  if (wValues.When && !wValues.Why) {
    warnings.push('Timing is present but no reason/impact is captured.');
  }
  if (wValues.What && !wValues.Why) {
    warnings.push('Update has a factual change but no stakeholder meaning yet.');
  }

  return {
    missing: missing,
    warnings: warnings,
    complete: missing.length === 0,
    verifiedContextCount: Object.keys(verifiedByDimension).length
  };
}

function handleBuildReviewGuidanceSkill_(input) {
  const item = input.item || {};
  const graphContext = input.graphContext || runSkillOrThrow_('resolve_graph_context', {
    flowId: item['Flow ID']
  });
  const analysis = input.analysis || runSkillOrThrow_('analyze_review_completeness', {
    item: item,
    graphContext: graphContext
  });
  const known = (graphContext.wNodes || [])
    .filter(node => node.Status === 'VERIFIED' && node['User Actual'])
    .map(node => node.Dimension + ': ' + node['User Actual']);
  const suggestions = [];
  if (analysis.missing.indexOf('Why') >= 0) suggestions.push('Confirm why this matters to stakeholders.');
  if (analysis.missing.indexOf('When') >= 0) suggestions.push('Confirm timing or next decision point if relevant.');
  if (analysis.missing.indexOf('Who') >= 0) suggestions.push('Confirm the accountable owner.');

  return {
    knownContext: known,
    missingContext: analysis.missing,
    warnings: analysis.warnings,
    suggestedClarifications: suggestions,
    advisoryOnly: true
  };
}

function handleCheckGraphHealthSkill_() {
  if (!isGraphMemoryEnabled_()) {
    return {
      ok: true,
      enabled: false,
      entityCount: 0,
      wNodeCount: 0,
      edgeCount: 0,
      orphanWNodeCount: 0,
      incompleteEntityCount: 0,
      orphanEdgeCount: 0
    };
  }

  const entities = getGraphObjects_(HUB.SHEETS.GRAPH_ENTITIES);
  const wNodes = getGraphObjects_(HUB.SHEETS.GRAPH_W_NODES);
  const edges = getGraphObjects_(HUB.SHEETS.GRAPH_EDGES);
  const entityIds = entities.map(row => row['Entity ID']);
  const wNodeIds = wNodes.map(row => row['W Node ID']);
  const orphanWNodes = wNodes.filter(row => entityIds.indexOf(row['Entity ID']) < 0);
  const incompleteEntities = entities.filter(entity => {
    const count = wNodes.filter(node => node['Entity ID'] === entity['Entity ID']).length;
    return count < GRAPH_W_DIMENSIONS.length;
  });
  const orphanEdges = edges.filter(edge => {
    const source = edge['Source Node ID'];
    const target = edge['Target Node ID'];
    return (source.indexOf('entity:') === 0 && entityIds.indexOf(source) < 0) ||
      (target.indexOf('w:') === 0 && wNodeIds.indexOf(target) < 0);
  });

  return {
    entityCount: entities.length,
    wNodeCount: wNodes.length,
    edgeCount: edges.length,
    orphanWNodeCount: orphanWNodes.length,
    incompleteEntityCount: incompleteEntities.length,
    orphanEdgeCount: orphanEdges.length,
    ok: orphanWNodes.length === 0 && orphanEdges.length === 0
  };
}

function handleBackfillGraphFromHistorySkill_() {
  if (!isGraphMemoryEnabled_()) {
    return {
      skipped: true,
      historyRowsProcessed: 0,
      flowRowsProcessed: 0,
      reason: 'ENABLE_PASSIVE_GRAPH_MEMORY is not enabled.'
    };
  }

  const history = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.HISTORY);
  const flowState = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.FLOW_STATE);
  let historyCount = 0;
  let flowCount = 0;

  if (history && history.getLastRow() >= 2) {
    getObjects_(history).forEach(item => {
      if (!item['Flow ID']) return;
      if (graphEventExistsForQueueAction_(item['Queue ID'], 'history_backfill_verified') ||
        graphEventExistsForQueueAction_(item['Queue ID'], 'history_backfill_pending') ||
        graphEventExistsForQueueAction_(item['Queue ID'], 'discarded')) {
        return;
      }
      if ([HUB.STATUS.SENT, HUB.STATUS.LOGGED].indexOf(item.Status) >= 0) {
        graphRecordVerifiedQueueItemSafe_(item, 'history_backfill_verified');
      } else if (item.Status === HUB.STATUS.DISCARDED) {
        graphRecordDiscardSafe_(item, 'History backfill discard.');
      } else {
        graphRecordDraftSafe_(item, 'history_backfill_pending');
      }
      historyCount++;
    });
  }

  if (flowState && flowState.getLastRow() >= 2) {
    getObjects_(flowState).forEach(flow => {
      graphSyncFlowStateSafe_(flow);
      flowCount++;
    });
  }

  return {
    historyRowsProcessed: historyCount,
    flowRowsProcessed: flowCount
  };
}

function graphEventExistsForQueueAction_(queueId, action) {
  if (!queueId || !action) return false;
  return getGraphObjects_(HUB.SHEETS.GRAPH_EVENTS).some(row =>
    String(row['Queue ID']) === String(queueId) &&
    String(row['Graph Action']) === String(action)
  );
}
