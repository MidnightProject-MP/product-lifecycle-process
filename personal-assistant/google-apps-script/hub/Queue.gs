function insertQueueDraftAtTop_(draft) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const payload = normalizePayload_(draft);
  const eventKey = draft['Event Key'] || payload.event_key || payload.eventKey || inferEventKeyFromLegacy_(draft['Communication Event']);

  if (!eventKey) {
    throw new Error('Missing Event Key. Queue drafts must map to one registry event.');
  }

  payload.event_key = eventKey;
  const lane = draft.Lane || payload.lane || inferLaneFromEventKey_(eventKey);
  if (lane) payload.lane = lane;
  enrichPayloadFromDraft_(payload, draft);

  const normalizedDraft = Object.assign({}, draft, {
    Lane: lane,
    'Event Key': eventKey,
    'Payload JSON': stringifyJson_(payload)
  });
  normalizedDraft['Flow ID'] = normalizedDraft['Flow ID'] || buildFlowId_(normalizedDraft);
  normalizedDraft['Dedupe Key'] = normalizedDraft['Dedupe Key'] || buildDedupeKey_(normalizedDraft);
  const dedupeKey = normalizedDraft['Dedupe Key'];
  const existingQueueId = findActiveQueueIdByDedupeKey_(sheet, dedupeKey);
  if (existingQueueId) {
    logHub_('INFO', 'insertQueueDraftAtTop_', existingQueueId, 'Skipped duplicate active draft.', { dedupeKey: dedupeKey });
    return existingQueueId;
  }

  const rowObject = Object.assign({}, normalizedDraft, {
    'Queue ID': normalizedDraft['Queue ID'] || uuid_(),
    'Flow ID': normalizedDraft['Flow ID'],
    'Dedupe Key': normalizedDraft['Dedupe Key'],
    'Created At': normalizedDraft['Created At'] || nowIso_(),
    'Updated At': nowIso_(),
    'Status': normalizedDraft.Status || HUB.STATUS.DRAFT
  });

  insertObjectRowAtTop_(sheet, rowObject);
  runSkill('record_graph_memory', {
    action: 'draft_created',
    item: rowObject
  });
  logHub_('INFO', 'insertQueueDraftAtTop_', rowObject['Queue ID'], 'Draft inserted into Queue.', {
    lane: rowObject.Lane,
    eventKey: rowObject['Event Key'],
    dedupeKey: rowObject['Dedupe Key']
  });
  syncReviewSheetFromQueueSafe_();
  return rowObject['Queue ID'];
}

function sendApprovedQueueRow_(sheet, row, parentRunId) {
  let item = getRowObject_(sheet, row);
  const workflowRunId = parentRunId || uuid_();

  try {
    item = normalizeQueueRowBeforeSend_(sheet, row, item);
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Preparing approved queue row.', {
      row: row,
      lane: item.Lane,
      eventKey: item['Event Key']
    });
    if (!item['Approved At']) {
      updateRowFields_(sheet, row, { 'Approved At': nowIso_() });
    }

    const policy = runSkillOrThrow_('resolve_template_policy', {
      item: item
    }, { parentRunId: workflowRunId });
    const template = policy.template;
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Template found.', {
      templateKey: template['Template Key'],
      postMode: template['Post Mode'],
      channelType: template['Channel Type'],
      anchorUpdatePolicy: template['Anchor Update Policy'] || '',
      threadReplyPolicy: template['Thread Reply Policy'] || '',
      replyBroadcast: template['Reply Broadcast'] || ''
    });

    applyTemplateDefaults_(sheet, row, item, template);
    const hydratedItem = getRowObject_(sheet, row);
    runSkillOrThrow_('validate_template_variables', {
      template: template,
      item: hydratedItem
    }, { parentRunId: workflowRunId });
    const existingFlow = findFlowStateByFlowId_(hydratedItem['Flow ID']);
    validateFlowSequence_(hydratedItem, existingFlow);

    const sendRule = String(hydratedItem['Send Rule'] || template['Default Send Rule'] || '').trim();
    if (sendRule.toLowerCase() === 'log only') {
      const completedAt = nowIso_();
      updateRowFields_(sheet, row, {
        'Status': HUB.STATUS.LOGGED,
        'Updated At': completedAt,
        'Error': ''
      });
      const loggedItem = buildCompletedCommunicationItem_(getRowObject_(sheet, row), {
        status: HUB.STATUS.LOGGED,
        completedAt: completedAt
      });
      runSkill('record_graph_memory', {
        action: 'logged_verified',
        item: loggedItem
      }, { parentRunId: workflowRunId });
      runSkillOrThrow_('advance_flow_state', {
        item: loggedItem,
        template: template,
        sendResult: null,
        previousFlow: existingFlow
      }, { parentRunId: workflowRunId });
      runSkillOrThrow_('record_history', {
        queueId: loggedItem['Queue ID'],
        row: row,
        item: loggedItem
      }, { parentRunId: workflowRunId });
      deleteQueueRow_(sheet, row, item['Queue ID'], HUB.STATUS.LOGGED);
      runSkill('schedule_next_flow_draft', {
        item: loggedItem
      }, { parentRunId: workflowRunId });
      logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Queue row logged without Slack send.', {
        sendRule: sendRule,
        eventKey: hydratedItem['Event Key']
      });
      return;
    }

    const anchorRender = runSkillOrThrow_('render_anchor_message', {
      template: template,
      item: hydratedItem
    }, { parentRunId: workflowRunId });
    const anchorText = anchorRender.text || '';
    if (shouldCreateAnchorMessage_(template, hydratedItem) && !String(anchorText || '').trim()) {
      throw new Error('Rendered Slack message is empty for Event Key: ' + hydratedItem['Event Key']);
    }

    const target = runSkillOrThrow_('resolve_slack_target', {
      template: template,
      item: hydratedItem,
      existingFlow: existingFlow
    }, { parentRunId: workflowRunId });
    const channel = target.channel;
    const threadTs = target.threadTs || '';
    const replyRender = runSkillOrThrow_('render_thread_reply', {
      template: template,
      item: hydratedItem,
      existingFlow: existingFlow
    }, { parentRunId: workflowRunId });
    const historyText = replyRender.text || '';
    const shouldPostReply = target.shouldPostReply;
    const outboundText = threadTs && shouldPostReply ? historyText : anchorText;
    if (!String(outboundText || '').trim()) {
      throw new Error('Rendered Slack message is empty for Event Key: ' + hydratedItem['Event Key']);
    }
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Posting Slack message.', {
      channel: channel,
      threadTs: threadTs,
      textLength: outboundText.length,
      anchorTextLength: anchorText.length,
      historyTextLength: historyText.length,
      replyBroadcast: Boolean(target.shouldBroadcastReply)
    });
    const result = runSkillOrThrow_('post_slack_message', {
      channel: channel,
      text: outboundText,
      threadTs: threadTs,
      replyBroadcast: target.shouldBroadcastReply
    }, { parentRunId: workflowRunId });
    const initialThreadRecord = createInitialThreadHistoryReplyIfNeeded_(channel, historyText, result, threadTs, existingFlow, hydratedItem, template, workflowRunId);
    const messageResult = initialThreadRecord || result;

    const sentAt = nowIso_();
    const completedItem = buildCompletedCommunicationItem_(hydratedItem, {
      status: HUB.STATUS.SENT,
      completedAt: sentAt,
      slackThreadId: threadTs || result.ts,
      slackChannel: result.channel || channel,
      slackMessageTs: messageResult.ts || '',
      slackMessageUrl: messageResult.permalink || ''
    });
    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.SENT,
      'Updated At': sentAt,
      'Error': ''
    });
    const sentItem = buildCompletedCommunicationItem_(getRowObject_(sheet, row), completedItem);
    runSkill('record_graph_memory', {
      action: 'sent_verified',
      item: sentItem
    }, { parentRunId: workflowRunId });
    runSkill('update_slack_anchor', {
      flow: existingFlow,
      text: anchorText,
      item: sentItem,
      template: template
    }, { parentRunId: workflowRunId });
    runSkillOrThrow_('advance_flow_state', {
      item: sentItem,
      template: template,
      sendResult: result,
      previousFlow: existingFlow
    }, { parentRunId: workflowRunId });
    runSkillOrThrow_('record_history', {
      queueId: sentItem['Queue ID'],
      row: row,
      item: sentItem
    }, { parentRunId: workflowRunId });
    deleteQueueRow_(sheet, row, item['Queue ID'], HUB.STATUS.SENT);
    runSkill('schedule_next_flow_draft', {
      item: sentItem
    }, { parentRunId: workflowRunId });
    logHub_('INFO', 'sendApprovedQueueRow_', item['Queue ID'], 'Slack message sent and history recorded.', {
      slackThreadId: threadTs || result.ts,
      slackMessageTs: result.ts || '',
      permalink: result.permalink || ''
    });
  } catch (error) {
    updateRowFields_(sheet, row, {
      'Status': HUB.STATUS.ERROR,
      'Updated At': nowIso_(),
      'Error': error.message || String(error)
    });
    logHub_('ERROR', 'sendApprovedQueueRow_', item['Queue ID'], 'Failed to send approved queue row.', {
      error: error.message || String(error),
      stack: error.stack || ''
    });
  } finally {
    syncReviewSheetFromQueueSafe_();
  }
}

function normalizeQueueRowBeforeSend_(sheet, row, item) {
  const payload = normalizePayload_(item);
  const eventKey = item['Event Key'] || payload.event_key || payload.eventKey || inferEventKeyFromLegacy_(item['Communication Event']);
  if (!eventKey) {
    throw new Error('Missing Event Key. Queue rows must map to one registry event before sending.');
  }

  payload.event_key = eventKey;
  const lane = item.Lane || payload.lane || inferLaneFromEventKey_(eventKey);
  if (lane) payload.lane = lane;
  enrichPayloadFromDraft_(payload, item);

  const normalized = Object.assign({}, item, {
    Lane: lane,
    'Event Key': eventKey,
    'Payload JSON': stringifyJson_(payload)
  });
  const flowId = item['Flow ID'] || buildFlowId_(normalized);
  normalized['Flow ID'] = flowId;
  const dedupeKey = item['Dedupe Key'] || buildDedupeKey_(normalized);
  const updates = {};

  if (!item['Queue ID']) updates['Queue ID'] = uuid_();
  if (!item['Flow ID']) updates['Flow ID'] = flowId;
  if (!item['Dedupe Key']) updates['Dedupe Key'] = dedupeKey;
  if (!item['Created At']) updates['Created At'] = nowIso_();
  if (lane && item.Lane !== lane) updates.Lane = lane;
  if (item['Event Key'] !== eventKey) updates['Event Key'] = eventKey;
  if (item['Payload JSON'] !== normalized['Payload JSON']) updates['Payload JSON'] = normalized['Payload JSON'];

  if (Object.keys(updates).length) {
    updates['Updated At'] = nowIso_();
    updateRowFields_(sheet, row, updates);
    logHub_('INFO', 'normalizeQueueRowBeforeSend_', updates['Queue ID'] || item['Queue ID'], 'Normalized Queue row before send.', {
      row: row,
      flowId: updates['Flow ID'] || item['Flow ID'],
      eventKey: eventKey,
      updatedFields: Object.keys(updates)
    });
    return getRowObject_(sheet, row);
  }

  return item;
}

function processApprovedQueueRows_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet) throw new Error('Queue sheet is missing.');
  if (sheet.getLastRow() < 2) return 0;

  const headers = getHeaders_(sheet);
  const statusIndex = headers.indexOf('Status');
  const queueIdIndex = headers.indexOf('Queue ID');
  if (statusIndex < 0) throw new Error('Queue sheet is missing Status header.');

  const rowCount = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, rowCount, headers.length).getValues();
  let processed = 0;

  values.forEach((rowValues, index) => {
    const status = String(rowValues[statusIndex] || '').trim();
    if (status !== HUB.STATUS.APPROVED) return;

    const queueId = queueIdIndex >= 0 ? rowValues[queueIdIndex] : '';
    const sheetRow = findQueueRowByQueueId_(sheet, queueId);
    if (!sheetRow) return;
    logHub_('INFO', 'processApprovedQueueRows_', queueId, 'Processing approved Queue row from scan.', {
      row: sheetRow
    });
    runSkillOrThrow_('approve_draft', {
      queueId: queueId,
      row: sheetRow
    });
    processed++;
  });

  return processed;
}

function applyTemplateDefaults_(sheet, row, item, template) {
  const updates = {};
  if (!item['Send Rule'] && template['Default Send Rule']) {
    updates['Send Rule'] = template['Default Send Rule'];
  }
  if (Object.keys(updates).length) {
    updateRowFields_(sheet, row, updates);
    logHub_('INFO', 'applyTemplateDefaults_', item['Queue ID'], 'Applied template defaults.', updates);
  }
}

function insertHistoryFromQueueRowAtTop_(queueSheet, row) {
  const ss = SpreadsheetApp.getActive();
  const historySheet = ensureSheet_(ss, HUB.SHEETS.HISTORY, HUB.HEADERS.HISTORY);
  const item = arguments.length > 2 && arguments[2] ? arguments[2] : getRowObject_(queueSheet, row);
  insertObjectRowAtTop_(historySheet, buildHistoryRowFromCommunicationItem_(item));
  logHub_('INFO', 'insertHistoryFromQueueRowAtTop_', item['Queue ID'], 'Copied queue row to History.', {
    flowId: item['Flow ID'],
    status: item.Status
  });
}

function buildCompletedCommunicationItem_(item, completion) {
  const merged = Object.assign({}, hydrateCommunicationObject_(item), completion || {});
  const payload = normalizePayload_(merged);
  const status = completion && completion.status || completion && completion.Status || merged.Status || '';
  const completedAt = completion && completion.completedAt || completion && completion['Completed At'] || merged['Completed At'] || merged['Sent At'] || nowIso_();

  if (status) merged.Status = status;
  merged['Completed At'] = completedAt;
  merged['Sent At'] = completedAt;
  if (completion && completion.error != null) merged.Error = completion.error;
  if (completion && completion.slackThreadId) {
    merged['Slack Thread ID'] = completion.slackThreadId;
    merged['Slack Thread TS'] = completion.slackThreadId;
  }
  if (completion && completion.slackChannel) merged['Slack Channel'] = completion.slackChannel;
  if (completion && completion.slackMessageTs) merged['Slack Message TS'] = completion.slackMessageTs;
  if (completion && completion.slackMessageUrl) merged['Slack Message URL'] = completion.slackMessageUrl;
  if (!merged.Owner && payload.owner) merged.Owner = payload.owner;
  if (!merged.Lane && payload.lane) merged.Lane = payload.lane;
  if (!merged.Priority && payload.priority) merged.Priority = payload.priority;
  return merged;
}

function buildHistoryRowFromCommunicationItem_(item) {
  item = hydrateCommunicationObject_(item);
  const payload = normalizePayload_(item);
  const subject = payload.subject ||
    payload.project ||
    payload.release_name ||
    payload.issue_title ||
    payload.release_id ||
    item['Flow ID'] ||
    '';
  const payloadText = item['Payload JSON'] || stringifyJson_(payload);
  return {
    'History ID': uuid_(),
    'Queue ID': item['Queue ID'] || '',
    'Flow ID': item['Flow ID'] || '',
    'Event Key': item['Event Key'] || payload.event_key || '',
    'Final Status': item.Status || '',
    Subject: subject,
    Owner: item.Owner || payload.owner || '',
    'Completed At': item['Completed At'] || item['Sent At'] || item['Updated At'] || nowIso_(),
    'Slack Channel': item['Slack Channel'] || '',
    'Slack Thread TS': item['Slack Thread TS'] || item['Slack Thread ID'] || '',
    'Slack Message TS': item['Slack Message TS'] || '',
    'Slack Message URL': item['Slack Message URL'] || '',
    'Payload Hash': graphHashString_(payloadText),
    Error: item.Error || ''
  };
}

function archiveAndDeleteQueueRow_(queueSheet, row, finalStatus, finalError) {
  const item = buildCompletedCommunicationItem_(getRowObject_(queueSheet, row), {
    status: finalStatus,
    completedAt: nowIso_(),
    error: finalError == null ? '' : finalError
  });
  const queueId = item['Queue ID'];
  if (finalStatus === HUB.STATUS.DISCARDED) {
    runSkill('record_graph_memory', {
      action: 'discarded',
      item: item,
      reason: finalError
    });
  }
  updateRowFields_(queueSheet, row, {
    Status: finalStatus,
    'Updated At': nowIso_(),
    Error: finalError == null ? '' : finalError
  });
  insertHistoryFromQueueRowAtTop_(queueSheet, row, item);
  deleteQueueRow_(queueSheet, row, queueId, finalStatus);
}

function deleteQueueRow_(sheet, row, queueId, status) {
  sheet.deleteRow(row);
  logHub_('INFO', 'deleteQueueRow_', queueId, 'Removed completed row from active Queue.', {
    row: row,
    status: status
  });
}

function getRowObject_(sheet, row) {
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  const object = headers.reduce((obj, header, index) => {
    obj[header] = values[index];
    return obj;
  }, {});
  return hydrateCommunicationObject_(object);
}

function insertObjectRowAtTop_(sheet, object) {
  const headers = getHeaders_(sheet);
  const values = headers.map(header => normalizeHubCellValue_(header, object[header]));
  insertValuesAtTop_(sheet, values);
}

function updateRowFields_(sheet, row, fields) {
  const headers = getHeaders_(sheet);
  Object.keys(fields).forEach(key => {
    const col = headers.indexOf(key) + 1;
    if (col > 0) {
      const range = sheet.getRange(row, col);
      if (shouldPreserveHubCellAsText_(key)) range.setNumberFormat('@');
      range.setValue(normalizeHubCellValue_(key, fields[key]));
    }
  });
}

function findActiveQueueIdByDedupeKey_(sheet, dedupeKey) {
  if (!dedupeKey) return '';
  const rows = getObjects_(sheet);
  const active = rows.find(row =>
    row['Dedupe Key'] === dedupeKey &&
    [HUB.STATUS.DRAFT, HUB.STATUS.APPROVED, HUB.STATUS.SCHEDULED].indexOf(row.Status) >= 0
  );
  return active ? active['Queue ID'] : '';
}

function findQueueRowByQueueId_(sheet, queueId) {
  if (!queueId || sheet.getLastRow() < 2) return 0;

  const headers = getHeaders_(sheet);
  const queueIdIndex = headers.indexOf('Queue ID');
  if (queueIdIndex < 0) throw new Error('Queue sheet is missing Queue ID header.');

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][queueIdIndex]) === String(queueId)) return i + 2;
  }

  return 0;
}

function buildFlowId_(draft) {
  const payload = normalizePayload_(draft);
  const lane = normalizeHubKey_(draft.Lane || payload.lane || 'flow');
  const subject = payload.flow_id ||
    payload.project ||
    payload.release_id ||
    payload.release_name ||
    payload.issue_title ||
    uuid_();
  return lane + '-' + normalizeHubKey_(subject);
}

function buildDedupeKey_(draft) {
  const payload = normalizePayload_(draft);
  return [
    draft.Source || '',
    draft.Lane || payload.lane || '',
    draft['Event Key'] || payload.event_key || '',
    payload.project || payload.release_name || payload.issue_title || draft['Flow ID'] || '',
    payload.what || payload.reason || ''
  ].join('|');
}

function resolveThreadTs_(template, item) {
  if (item['Slack Thread ID']) return shouldReplyInThread_(template, item) ? item['Slack Thread ID'] : '';
  if (!shouldReplyInThread_(template, item)) return '';

  const priorThread = findThreadForFlow_(item['Flow ID']);
  logHub_('INFO', 'resolveThreadTs_', item['Queue ID'], 'Resolved thread from history.', {
    flowId: item['Flow ID'],
    priorThread: priorThread
  });
  return priorThread || '';
}

function findThreadForFlow_(flowId) {
  if (!flowId) return '';
  const ss = SpreadsheetApp.getActive();
  const historySheet = ss.getSheetByName(HUB.SHEETS.HISTORY);
  if (!historySheet) return '';

  const rows = getObjects_(historySheet)
    .filter(row => row['Flow ID'] === flowId && (row['Slack Thread TS'] || row['Slack Thread ID']));

  return rows.length ? (rows[0]['Slack Thread TS'] || rows[0]['Slack Thread ID']) : '';
}

function normalizePayload_(draft) {
  const payload = parseJsonObject_(draft['Payload JSON']);
  const mappings = {
    Subject: 'subject',
    Project: 'project',
    Owner: 'owner',
    Priority: 'priority',
    What: 'what',
    'So What': 'so_what',
    "What's Next": 'whats_next',
    Reason: 'reason',
    Destination: 'destination',
    Scenario: 'scenario',
    'Lifecycle Stage': 'lifecycle_stage',
    'Communication Event': 'communication_event',
    'Release ID': 'release_id',
    'Release Name': 'release_name'
  };

  Object.keys(mappings).forEach(source => {
    const target = mappings[source];
    if (draft[source] == null || draft[source] === '') return;
    if (payload[target] == null || payload[target] === '') payload[target] = draft[source];
  });

  if (draft['Event Key'] && !payload.event_key) payload.event_key = draft['Event Key'];
  if (draft.Lane && !payload.lane) payload.lane = draft.Lane;
  enrichPayloadFromDraft_(payload, draft);
  const subject = payload.subject ||
    payload.project ||
    payload.release_name ||
    payload.issue_title ||
    payload.release_id ||
    draft['Flow ID'] ||
    '';
  if (subject && !payload.subject) payload.subject = subject;
  return payload;
}

function enrichPayloadFromDraft_(payload, draft) {
  if (!payload || !draft) return payload || {};
  if (draft.Lane && !payload.lane) payload.lane = draft.Lane;
  if (draft.Priority && !payload.priority) payload.priority = draft.Priority;
  if (draft['Parent Queue ID'] && !payload.parent_queue_id) payload.parent_queue_id = draft['Parent Queue ID'];
  if (draft['Expected Previous Event Key'] && !payload.expected_previous_event_key) payload.expected_previous_event_key = draft['Expected Previous Event Key'];
  if (draft['Path Override'] && !payload.path_override) payload.path_override = draft['Path Override'];
  if (draft['Scheduled For'] && !payload.scheduled_for) payload.scheduled_for = draft['Scheduled For'];
  if (draft['Approved At'] && !payload.approved_at) payload.approved_at = draft['Approved At'];
  if (draft['Sent At'] && !payload.sent_at) payload.sent_at = draft['Sent At'];
  return payload;
}

function inferEventKeyFromLegacy_(eventName) {
  const eventKeyByName = {
    'project kickoff': 'project.kickoff',
    'weekly project digest item': 'project.weekly_digest',
    'gate approaching': 'project.gate_approaching',
    'gate passed': 'project.gate_passed',
    'project completed': 'project.completed',
    'unexpected status change': 'project.unexpected_status_change',
    'timeline updated': 'project.timeline_updated',
    'gate missed / failed / delayed': 'project.gate_exception',
    'critical bug identified': 'incident.critical.identified',
    investigating: 'incident.critical.investigating',
    'fix in progress': 'incident.critical.fix_in_progress',
    'fix in qa': 'incident.critical.fix_in_qa',
    'fix ready for release': 'incident.critical.ready_for_release',
    'critical bug state regressed': 'incident.critical.regressed',
    'critical bug delayed': 'incident.critical.delayed',
    'fix failed': 'incident.critical.fix_failed',
    'stray story submitted': 'stray.submitted',
    'weekly prioritization summary': 'stray.weekly_summary',
    'disposition changed': 'stray.disposition_changed',
    'stray story exited intake': 'stray.exited_intake',
    'release scheduled': 'release.scheduled',
    'go / no-go approaching': 'release.go_no_go',
    'release started': 'release.started',
    'release completed': 'release.completed',
    'release delayed': 'release.delayed',
    'release rolled back': 'release.rolled_back',
    'postmortem needed': 'release.postmortem_needed',
    'postmortem required': 'release.postmortem_needed'
  };
  return eventKeyByName[String(eventName || '').trim().toLowerCase()] || '';
}

function inferLaneFromEventKey_(eventKey) {
  const prefix = String(eventKey || '').split('.')[0];
  const lanes = {
    project: 'Project',
    incident: 'Incident / Bug',
    release: 'Production Release',
    stray: 'Stray Story'
  };
  return lanes[prefix] || '';
}

function normalizeHubKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildWeeklyProjectDigestDraft() {
  const dashboardId = getScriptProperty_('DASHBOARD_SPREADSHEET_ID');
  if (!dashboardId) throw new Error('Missing DASHBOARD_SPREADSHEET_ID script property.');

  const dashboard = SpreadsheetApp.openById(dashboardId);
  const projectSheet = dashboard.getSheetByName('Projects');
  if (!projectSheet) throw new Error('Projects sheet is missing in dashboard.');

  const projects = getObjects_(projectSheet).filter(row => row.Project);
  const active = projects.filter(row => String(row.Status || '').toLowerCase() !== 'done');
  const what = active.map(row => {
    return '- ' + row.Project +
      ' | Phase: ' + (row['Current Phase'] || 'TBD') +
      ' | Status: ' + (row.Status || 'TBD') +
      ' | Risk: ' + (row['Primary Risk'] || 'None listed') +
      ' | Next Gate: ' + (row['Next Major Gate'] || 'TBD') +
      ' (' + (row['Next Gate ETA'] || 'TBD') + ')';
  }).join('\n') || 'No active projects found.';

  const digestDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const queued = runSkillOrThrow_('queue_communication_draft', {
    draft: {
    Source: 'Scheduled Digest',
    Lane: 'Project',
    'Event Key': 'project.weekly_digest',
    Priority: 'Medium',
    Owner: 'TPM',
    'Flow ID': 'project-weekly-digest-' + digestDate,
    'Dedupe Key': 'weekly-project-digest|' + digestDate,
    'Payload JSON': stringifyJson_({
      project: 'Weekly Project Digest',
      owner: 'TPM',
      what: what,
      so_what: 'This is the heartbeat summary for active project movement, risks, and gates.',
      whats_next: 'Review exceptions, decisions, and high-risk gates. Approve this draft to send the weekly digest.'
    })
    }
  });
  return queued.queueId;
}

function debugSendQueueRow(rowNumber) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet) throw new Error('Queue sheet is missing.');
  sendApprovedQueueRow_(sheet, rowNumber);
}
