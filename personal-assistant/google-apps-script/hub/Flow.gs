function resolveThreadTsForSend_(template, item, flow) {
  if (flow && flow['Thread TS']) {
    logHub_('INFO', 'resolveThreadTsForSend_', item['Queue ID'], 'Resolved Slack thread from Flow_State.', {
      flowId: item['Flow ID'],
      threadTs: flow['Thread TS']
    });
    return flow['Thread TS'];
  }
  if (flow && flow['Anchor Message TS']) {
    logHub_('INFO', 'resolveThreadTsForSend_', item['Queue ID'], 'Resolved Slack thread from Flow_State anchor.', {
      flowId: item['Flow ID'],
      anchorMessageTs: flow['Anchor Message TS']
    });
    return flow['Anchor Message TS'];
  }
  if (item['Slack Thread ID']) return shouldReplyInThread_(template, item) ? item['Slack Thread ID'] : '';
  if (!shouldReplyInThread_(template, item)) return '';

  const priorThread = findThreadForFlow_(item['Flow ID']);
  if (priorThread) {
    logHub_('INFO', 'resolveThreadTsForSend_', item['Queue ID'], 'Resolved Slack thread from History fallback.', {
      flowId: item['Flow ID'],
      threadTs: priorThread
    });
    return priorThread;
  }

  logHub_('WARN', 'resolveThreadTsForSend_', item['Queue ID'], 'No parent Slack thread found for threaded update; Slack will create a new top-level message.', {
    flowId: item['Flow ID'],
    eventKey: item['Event Key'],
    postMode: template['Post Mode']
  });
  return '';
}

function validateFlowSequence_(item, flow) {
  if (!flow) return;

  const expectedPreviousEventKey = String(item['Expected Previous Event Key'] || '').trim();
  const currentEventKey = String(flow['Current Event Key'] || '').trim();
  if (expectedPreviousEventKey && currentEventKey && expectedPreviousEventKey !== currentEventKey) {
    throw new Error(
      'This draft expected the flow to be at ' + expectedPreviousEventKey +
      ', but the current flow state is ' + currentEventKey +
      '. Refresh or replace this draft before sending.'
    );
  }

  const nextHappyEventKey = String(flow['Next Happy Event Key'] || '').trim();
  const returnEventKey = String(flow['Return Event Key'] || '').trim();
  const allowedSadPathEventKeys = String(getFlowAllowedDetourEventKeys_(flow) || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value);
  const eventKey = String(item['Event Key'] || '').trim();

  if (
    eventKey &&
    nextHappyEventKey &&
    eventKey !== nextHappyEventKey &&
    eventKey !== returnEventKey &&
    allowedSadPathEventKeys.indexOf(eventKey) < 0
  ) {
    logHub_('WARN', 'validateFlowSequence_', item['Queue ID'], 'Flow update does not match the recorded next happy-path or allowed sad-path events.', {
      flowId: item['Flow ID'],
      currentEventKey: currentEventKey,
      eventKey: eventKey,
      nextHappyEventKey: nextHappyEventKey,
      allowedSadPathEventKeys: allowedSadPathEventKeys,
      returnEventKey: returnEventKey
    });
  }
}

function createInitialThreadHistoryReplyIfNeeded_(channel, historyText, anchorResult, threadTs, flow, item, template, parentRunId) {
  if (flow || threadTs || !anchorResult || !anchorResult.ts) return null;
  if (!shouldReplyInThread_(template, item)) return null;

  try {
    const result = runSkillOrThrow_('post_slack_message', {
      channel: channel,
      text: historyText,
      threadTs: anchorResult.ts,
      replyBroadcast: false
    }, { parentRunId: parentRunId || '' });
    logHub_('INFO', 'createInitialThreadHistoryReplyIfNeeded_', item['Queue ID'], 'Posted initial update as first thread history record.', {
      flowId: item['Flow ID'],
      anchorMessageTs: anchorResult.ts,
      historyMessageTs: result.ts
    });
    return result;
  } catch (error) {
    logHub_('WARN', 'createInitialThreadHistoryReplyIfNeeded_', item['Queue ID'], 'Failed to post initial thread history record; anchor remains posted.', {
      flowId: item['Flow ID'],
      anchorMessageTs: anchorResult.ts,
      error: error.message || String(error)
    });
    return null;
  }
}

function buildThreadHistoryText_(item, template, label) {
  const payload = normalizePayload_(item);
  const eventName = getEventDisplayName_(item['Event Key']);
  const title = label || 'Update';
  const lines = [
    '*' + title + ': ' + eventName + '*'
  ];

  const keyUpdate = payload.what || payload.reason || payload.status || '';
  const next = payload.whats_next || payload.next || '';
  const impact = payload.so_what || payload.impact || '';

  if (keyUpdate) lines.push('*Key update:* ' + keyUpdate);
  if (impact) lines.push('*Impact:* ' + impact);
  if (next) lines.push('*Next:* ' + next);
  if (item.Owner || payload.owner) lines.push('*Owner:* ' + (item.Owner || payload.owner));

  return lines.join('\n');
}

function getEventDisplayName_(eventKey) {
  const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey) || {};
  return event['Communication Event'] || eventKey || 'Update';
}

function recordFlowStateAfterSend_(item, template, sendResult, previousFlow) {
  if (!item['Flow ID']) return;

  const event = findRegistryRow_('Event_Catalog', 'Event Key', item['Event Key']) || {};
  const transition = findTransitionForEvent_(item['Event Key']);
  const payload = normalizePayload_(item);
  const subject = buildFlowSubject_(item, payload);
  const slackChannel = item['Slack Channel'] || (sendResult && sendResult.channel) || (previousFlow && previousFlow['Slack Channel']) || '';
  const anchorTs = (previousFlow && previousFlow['Anchor Message TS']) ||
    item['Slack Thread ID'] ||
    item['Slack Message TS'] ||
    (sendResult && sendResult.ts) ||
    '';
  const threadTs = (previousFlow && previousFlow['Thread TS']) ||
    item['Slack Thread ID'] ||
    anchorTs;
  const latestReplyTs = item['Slack Message TS'] || (sendResult && sendResult.ts) || (previousFlow && previousFlow['Latest Reply TS']) || '';
  const anchorUrl = (previousFlow && previousFlow['Anchor Message URL']) ||
    (sendResult && sendResult.permalink) ||
    item['Slack Message URL'] ||
    '';
  const terminal = String(transition['Flow Terminal'] || '').toUpperCase() === 'TRUE';

  upsertFlowState_({
    'Flow ID': item['Flow ID'],
    'Flow Type': item.Lane || inferLaneFromEventKey_(item['Event Key']),
    Subject: subject,
    Owner: item.Owner || payload.owner || '',
    'Flow Status': terminal ? 'Completed' : 'Active',
    'Current Event Key': item['Event Key'],
    'Next Happy Event Key': transition['Next Happy Event Key'] || '',
    'Allowed Detour Event Keys': transition['Allowed Detour Event Keys'] || transition['Allowed Sad Path Event Keys'] || '',
    'Return Event Key': transition['Return Event Key'] || '',
    'Slack Channel': slackChannel,
    'Anchor Message TS': anchorTs,
    'Thread TS': threadTs,
    'Latest Reply TS': latestReplyTs,
    'Anchor Message URL': anchorUrl,
    'Last Queue ID': item['Queue ID'],
    'Last Confirmed At': item['Sent At'] || item['Completed At'] || nowIso_(),
    'State JSON': stringifyJson_(payload),
    'Updated At': nowIso_()
  });
}

function updateSlackAnchorIfNeeded_(flow, text, item, template) {
  if (!flow || !flow['Anchor Message TS'] || !flow['Slack Channel']) return null;
  if (!shouldUpdateAnchorMessage_(template, item)) {
    logHub_('INFO', 'updateSlackAnchorIfNeeded_', item['Queue ID'], 'Skipped Slack anchor update by Registry policy.', {
      flowId: item['Flow ID'],
      anchorUpdatePolicy: template['Anchor Update Policy'] || ''
    });
    return null;
  }

  try {
    const anchorText = buildAnchorText_(text, item);
    const result = updateSlackMessage_(flow['Slack Channel'], flow['Anchor Message TS'], anchorText);
    logHub_('INFO', 'updateSlackAnchorIfNeeded_', item['Queue ID'], 'Updated Slack anchor message.', {
      flowId: item['Flow ID'],
      anchorMessageTs: flow['Anchor Message TS'],
      channel: flow['Slack Channel']
    });
    return result;
  } catch (error) {
    logHub_('WARN', 'updateSlackAnchorIfNeeded_', item['Queue ID'], 'Failed to update Slack anchor; thread reply remains recorded.', {
      flowId: item['Flow ID'],
      error: error.message || String(error)
    });
    return null;
  }
}

function createNextScheduledDraftIfNeeded_(sentItem) {
  const transition = findTransitionForEvent_(sentItem['Event Key']);
  archiveObsoleteScheduledDrafts_(sentItem, transition);
  if (!transition || String(transition['Auto Queue Next'] || '').toUpperCase() !== 'TRUE') return '';

  const nextEventKey = transition['Next Happy Event Key'];
  if (!nextEventKey || String(transition['Flow Terminal'] || '').toUpperCase() === 'TRUE') return '';

  const queueSheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  if (queueSheet) {
    const existing = findActiveQueueIdByDedupeKey_(queueSheet, buildNextDraftDedupeKey_(sentItem, nextEventKey));
    if (existing) return existing;
  }

  const payload = normalizePayload_(sentItem);
  payload.event_key = nextEventKey;
  payload.what = 'Draft placeholder for ' + getEventDisplayName_(nextEventKey) + ' after ' + getEventDisplayName_(sentItem['Event Key']) + '.';
  payload.so_what = payload.so_what || 'Stakeholders should receive this update after the release owner confirms the current state.';
  payload.whats_next = 'Update this draft with current details before approval.';

  const scheduledFor = new Date(Date.now() + Number(transition['Default Delay Minutes'] || 0) * 60000).toISOString();
  const queueId = insertQueueDraftAtTop_({
    Source: 'Flow Transition',
    Lane: sentItem.Lane,
    'Event Key': nextEventKey,
    'Parent Queue ID': sentItem['Queue ID'],
    'Expected Previous Event Key': sentItem['Event Key'],
    'Scheduled For': scheduledFor,
    Status: HUB.STATUS.SCHEDULED,
    Priority: sentItem.Priority,
    Owner: sentItem.Owner,
    'Flow ID': sentItem['Flow ID'],
    'Dedupe Key': buildNextDraftDedupeKey_(sentItem, nextEventKey),
    'Payload JSON': stringifyJson_(payload)
  });

  logHub_('INFO', 'createNextScheduledDraftIfNeeded_', sentItem['Queue ID'], 'Scheduled next happy-path draft.', {
    flowId: sentItem['Flow ID'],
    nextEventKey: nextEventKey,
    scheduledQueueId: queueId,
    scheduledFor: scheduledFor
  });
  return queueId;
}

function archiveObsoleteScheduledDrafts_(sentItem, transition) {
  const queueSheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
  if (!queueSheet || queueSheet.getLastRow() < 2 || !sentItem['Flow ID']) return;

  const nextEventKey = transition ? String(transition['Next Happy Event Key'] || '').trim() : '';
  const queueIds = getObjects_(queueSheet)
    .filter(row =>
      row['Flow ID'] === sentItem['Flow ID'] &&
      row['Queue ID'] !== sentItem['Queue ID'] &&
      String(row.Status || '').trim() === HUB.STATUS.SCHEDULED
    )
    .filter(row =>
      !nextEventKey ||
      row['Event Key'] !== nextEventKey ||
      hydrateCommunicationObject_(row)['Expected Previous Event Key'] !== sentItem['Event Key']
    )
    .map(row => row['Queue ID']);

  queueIds.forEach(queueId => {
    const row = findQueueRowByQueueId_(queueSheet, queueId);
    if (!row) return;
    archiveAndDeleteQueueRow_(queueSheet, row, HUB.STATUS.DISCARDED, 'Superseded by Queue ID ' + sentItem['Queue ID']);
    logHub_('INFO', 'archiveObsoleteScheduledDrafts_', queueId, 'Archived obsolete scheduled draft after flow moved.', {
      flowId: sentItem['Flow ID'],
      currentQueueId: sentItem['Queue ID'],
      currentEventKey: sentItem['Event Key'],
      nextEventKey: nextEventKey
    });
  });
}

function buildNextDraftDedupeKey_(sentItem, nextEventKey) {
  return [
    'flow-next',
    sentItem['Flow ID'],
    sentItem['Queue ID'],
    nextEventKey
  ].join('|');
}

function findFlowStateByFlowId_(flowId) {
  if (!flowId) return null;
  const sheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.FLOW_STATE);
  if (!sheet || sheet.getLastRow() < 2) return null;
  return getObjects_(sheet).find(row => String(row['Flow ID']) === String(flowId)) || null;
}

function upsertFlowState_(flowState) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(ss, HUB.SHEETS.FLOW_STATE, HUB.HEADERS.FLOW_STATE);
  const row = findFlowStateRowByFlowId_(sheet, flowState['Flow ID']);

  if (row) {
    updateRowFields_(sheet, row, flowState);
    runSkill('record_graph_memory', {
      action: 'flow_state_synced',
      flowState: flowState
    });
    logHub_('INFO', 'upsertFlowState_', flowState['Last Queue ID'], 'Updated Flow_State row.', {
      flowId: flowState['Flow ID'],
      currentEventKey: flowState['Current Event Key'],
      nextHappyEventKey: flowState['Next Happy Event Key']
    });
    return;
  }

  insertObjectRowAtTop_(sheet, flowState);
  runSkill('record_graph_memory', {
    action: 'flow_state_synced',
    flowState: flowState
  });
  logHub_('INFO', 'upsertFlowState_', flowState['Last Queue ID'], 'Inserted Flow_State row.', {
    flowId: flowState['Flow ID'],
    currentEventKey: flowState['Current Event Key'],
    nextHappyEventKey: flowState['Next Happy Event Key']
  });
}

function findFlowStateRowByFlowId_(sheet, flowId) {
  if (!flowId || sheet.getLastRow() < 2) return 0;
  const headers = getHeaders_(sheet);
  const flowIdIndex = headers.indexOf('Flow ID');
  if (flowIdIndex < 0) throw new Error('Flow_State sheet is missing Flow ID header.');

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][flowIdIndex]) === String(flowId)) return i + 2;
  }
  return 0;
}

function findTransitionForEvent_(eventKey) {
  if (!eventKey) return {};
  try {
    return findRegistryRow_('Event_Transitions', 'Event Key', eventKey) || {};
  } catch (error) {
    logHub_('WARN', 'findTransitionForEvent_', '', 'Transition lookup failed.', {
      eventKey: eventKey,
      error: error.message || String(error)
    });
    return {};
  }
}

function buildFlowSubject_(item, payload) {
  return payload.subject ||
    payload.project ||
    payload.release_name ||
    payload.issue_title ||
    payload.release_id ||
    item['Flow ID'] ||
    '';
}

function buildAnchorText_(text, item) {
  return String(text || '') +
    '\n\n_Current state: ' + getEventDisplayName_(item['Event Key']) + ' | Last updated: ' + nowIso_() + '_';
}

function getFlowAllowedDetourEventKeys_(flow) {
  return flow && (flow['Allowed Detour Event Keys'] || flow['Allowed Sad Path Event Keys']) || '';
}

function getFlowStatePayload_(flow) {
  return parseJsonObject_(flow && (flow['State JSON'] || flow['Payload JSON']));
}
