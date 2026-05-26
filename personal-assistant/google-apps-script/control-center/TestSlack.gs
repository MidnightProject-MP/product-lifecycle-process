function sendQueueDraftTestToSlack_(queueId, options) {
  options = options || {};
  const queueSheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const row = findQueueRowByQueueId_(queueSheet, queueId);
  if (!row) throw new Error('Queue row not found for test send: ' + queueId);

  const item = normalizeQueueRowBeforeSend_(queueSheet, row, getRowObject_(queueSheet, row));
  const result = sendQueueItemTestToSlack_(queueSheet, row, item, options);
  syncReviewSheetFromQueueSafe_();
  return result;
}

function autoSendQueueDraftTestSafe_(queueId, draftContext) {
  if (!shouldAutoSendTestOnQueue_()) return null;

  try {
    const queueSheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.QUEUE);
    const row = queueSheet ? findQueueRowByQueueId_(queueSheet, queueId) : 0;
    if (!row) return null;

    const item = getRowObject_(queueSheet, row);
    if (!shouldAutoSendTestForDraft_(item, draftContext || {})) return null;

    const result = sendQueueItemTestToSlack_(queueSheet, row, item, {
      source: 'auto_queue_test'
    });
    logHub_('INFO', 'autoSendQueueDraftTestSafe_', queueId, 'Automatically sent draft to test Slack channel.', {
      testSlackChannel: result.testSlackChannel || '',
      testSlackThreadTs: result.testSlackThreadTs || '',
      testSlackMessageTs: result.testSlackMessageTs || '',
      testSlackMessageUrl: result.testSlackMessageUrl || ''
    });
    return result;
  } catch (error) {
    logHub_('WARN', 'autoSendQueueDraftTestSafe_', queueId, 'Skipped automatic test Slack send.', {
      error: error.message || String(error)
    });
    return null;
  }
}

function sendQueueItemTestToSlack_(queueSheet, row, item, options) {
  options = options || {};
  const parentRunId = options.parentRunId || '';
  const policy = runSkillOrThrow_('resolve_template_policy', {
    item: item
  }, { parentRunId: parentRunId });
  const template = policy.template;

  applyTemplateDefaults_(queueSheet, row, item, template);
  const hydratedItem = getRowObject_(queueSheet, row);
  runSkillOrThrow_('validate_template_variables', {
    template: template,
    item: hydratedItem
  }, { parentRunId: parentRunId });

  const existingFlow = findFlowStateByFlowId_(hydratedItem['Flow ID']);
  const anchorRender = runSkillOrThrow_('render_anchor_message', {
    template: template,
    item: hydratedItem
  }, { parentRunId: parentRunId });
  const anchorText = anchorRender.text || '';
  if (shouldCreateAnchorMessage_(template, hydratedItem) && !String(anchorText || '').trim()) {
    throw new Error('Rendered test Slack message is empty for Event Key: ' + hydratedItem['Event Key']);
  }

  const target = resolveTestSlackTarget_(template, hydratedItem, existingFlow);
  const replyRender = runSkillOrThrow_('render_thread_reply', {
    template: template,
    item: hydratedItem,
    existingFlow: existingFlow
  }, { parentRunId: parentRunId });
  const historyText = replyRender.text || '';
  const outboundText = target.threadTs && target.shouldPostReply ? historyText : anchorText;
  if (!String(outboundText || '').trim()) {
    throw new Error('Rendered test Slack message is empty for Event Key: ' + hydratedItem['Event Key']);
  }

  logHub_('INFO', 'sendQueueItemTestToSlack_', hydratedItem['Queue ID'], 'Posting test Slack message.', {
    channel: target.channel,
    threadTs: target.threadTs || '',
    textLength: outboundText.length,
    spotlightPolicy: template['Spotlight Policy'] || ''
  });
  let postResult = null;
  let messageResult = null;
  let spotlightResult = null;

  if (target.threadTs && target.shouldPostReply) {
    postResult = runSkillOrThrow_('post_slack_message', {
      channel: target.channel,
      text: historyText,
      threadTs: target.threadTs || '',
      replyBroadcast: false
    }, { parentRunId: parentRunId });
    messageResult = postResult;
    spotlightResult = postSlackSpotlightReplyIfNeeded_(
      'Test',
      target.channel,
      buildAnchorText_(anchorText, hydratedItem),
      target.threadTs,
      existingFlow,
      hydratedItem,
      template,
      parentRunId
    );
  } else {
    postResult = runSkillOrThrow_('post_slack_message', {
      channel: target.channel,
      text: outboundText,
      threadTs: target.threadTs || '',
      replyBroadcast: false
    }, { parentRunId: parentRunId });
    const initialThreadRecord = createInitialTestThreadHistoryReplyIfNeeded_(target.channel, historyText, postResult, target.threadTs, existingFlow, hydratedItem, template, parentRunId);
    messageResult = initialThreadRecord || postResult;
  }
  updateTestSlackAnchorIfNeeded_(existingFlow, anchorText, hydratedItem, template);

  const sentAt = nowIso_();
  const completion = {
    testSlackChannel: postResult.channel || target.channel,
    testSlackThreadTs: target.threadTs || postResult.ts || '',
    testSlackMessageTs: messageResult.ts || '',
    testSlackMessageUrl: messageResult.permalink || '',
    testAnchorMessageTs: existingFlow && existingFlow['Test Anchor Message TS'] || postResult.ts || '',
    testAnchorMessageUrl: existingFlow && existingFlow['Test Anchor Message URL'] || postResult.permalink || '',
    testSpotlightTs: spotlightResult && spotlightResult.ts || '',
    testSpotlightUrl: spotlightResult && spotlightResult.permalink || '',
    testSentAt: sentAt
  };

  recordTestSlackMetadataOnQueueRow_(queueSheet, row, hydratedItem, completion);
  recordTestFlowStateAfterSend_(hydratedItem, template, completion, existingFlow);

  logHub_('INFO', 'sendQueueItemTestToSlack_', hydratedItem['Queue ID'], 'Test Slack message sent and recorded.', {
    testSlackChannel: completion.testSlackChannel,
    testSlackThreadTs: completion.testSlackThreadTs,
    testSlackMessageTs: completion.testSlackMessageTs,
    testSlackMessageUrl: completion.testSlackMessageUrl
  });
  return completion;
}

function resolveTestSlackTarget_(template, item, flow) {
  const channel = resolveTestChannel_(template['Channel Type']);
  const threadTs = resolveTestThreadTsForSend_(template, item, flow);
  return {
    channel: channel,
    threadTs: threadTs,
    shouldPostReply: shouldReplyInThread_(template, item),
    shouldBroadcastReply: Boolean(threadTs && shouldReplyInThread_(template, item) && shouldBroadcastThreadReply_(template, item))
  };
}

function resolveTestThreadTsForSend_(template, item, flow) {
  if (flow && flow['Test Thread TS']) return flow['Test Thread TS'];
  if (flow && flow['Test Anchor Message TS']) return flow['Test Anchor Message TS'];
  if (item['Test Slack Thread TS']) return shouldReplyInThread_(template, item) ? item['Test Slack Thread TS'] : '';
  if (!shouldReplyInThread_(template, item)) return '';
  return findTestThreadForFlow_(item['Flow ID']) || '';
}

function findTestThreadForFlow_(flowId) {
  if (!flowId) return '';
  const historySheet = SpreadsheetApp.getActive().getSheetByName(HUB.SHEETS.HISTORY);
  if (!historySheet) return '';

  const rows = getObjects_(historySheet)
    .filter(row => row['Flow ID'] === flowId && row['Test Slack Thread TS']);
  return rows.length ? rows[0]['Test Slack Thread TS'] : '';
}

function createInitialTestThreadHistoryReplyIfNeeded_(channel, historyText, anchorResult, threadTs, flow, item, template, parentRunId) {
  if (flow && (flow['Test Thread TS'] || flow['Test Anchor Message TS'])) return null;
  if (threadTs || !anchorResult || !anchorResult.ts) return null;
  if (!shouldReplyInThread_(template, item)) return null;

  try {
    const result = runSkillOrThrow_('post_slack_message', {
      channel: channel,
      text: historyText,
      threadTs: anchorResult.ts,
      replyBroadcast: false
    }, { parentRunId: parentRunId || '' });
    logHub_('INFO', 'createInitialTestThreadHistoryReplyIfNeeded_', item['Queue ID'], 'Posted initial test update as first thread history record.', {
      flowId: item['Flow ID'],
      testAnchorMessageTs: anchorResult.ts,
      testHistoryMessageTs: result.ts
    });
    return result;
  } catch (error) {
    logHub_('WARN', 'createInitialTestThreadHistoryReplyIfNeeded_', item['Queue ID'], 'Failed to post initial test thread history record; test anchor remains posted.', {
      flowId: item['Flow ID'],
      testAnchorMessageTs: anchorResult.ts,
      error: error.message || String(error)
    });
    return null;
  }
}

function updateTestSlackAnchorIfNeeded_(flow, text, item, template) {
  if (!flow || !flow['Test Anchor Message TS'] || !flow['Test Slack Channel']) return null;
  if (!shouldUpdateAnchorMessage_(template, item)) return null;

  try {
    const result = updateSlackMessage_(flow['Test Slack Channel'], flow['Test Anchor Message TS'], buildAnchorText_(text, item));
    logHub_('INFO', 'updateTestSlackAnchorIfNeeded_', item['Queue ID'], 'Updated test Slack anchor message.', {
      flowId: item['Flow ID'],
      testAnchorMessageTs: flow['Test Anchor Message TS'],
      testSlackChannel: flow['Test Slack Channel']
    });
    return result;
  } catch (error) {
    logHub_('WARN', 'updateTestSlackAnchorIfNeeded_', item['Queue ID'], 'Failed to update test Slack anchor; test thread reply remains recorded.', {
      flowId: item['Flow ID'],
      error: error.message || String(error)
    });
    return null;
  }
}

function recordTestSlackMetadataOnQueueRow_(queueSheet, row, item, completion) {
  const payload = normalizePayload_(item);
  payload.last_test_send = {
    channel: completion.testSlackChannel || '',
    thread_ts: completion.testSlackThreadTs || '',
    message_ts: completion.testSlackMessageTs || '',
    permalink: completion.testSlackMessageUrl || '',
    spotlight_ts: completion.testSpotlightTs || '',
    spotlight_permalink: completion.testSpotlightUrl || '',
    sent_at: completion.testSentAt || ''
  };

  updateRowFields_(queueSheet, row, {
    'Test Slack Channel': completion.testSlackChannel || '',
    'Test Slack Thread TS': completion.testSlackThreadTs || '',
    'Test Slack Message TS': completion.testSlackMessageTs || '',
    'Test Slack Message URL': completion.testSlackMessageUrl || '',
    'Test Sent At': completion.testSentAt || '',
    'Test Spotlight TS': completion.testSpotlightTs || '',
    'Test Spotlight URL': completion.testSpotlightUrl || '',
    'Payload JSON': stringifyJson_(payload),
    'Updated At': nowIso_(),
    Error: ''
  });
}

function recordTestFlowStateAfterSend_(item, template, completion, previousFlow) {
  if (!item || !item['Flow ID']) return;

  const ss = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(ss, HUB.SHEETS.FLOW_STATE, HUB.HEADERS.FLOW_STATE);
  const row = findFlowStateRowByFlowId_(sheet, item['Flow ID']);
  const payload = normalizePayload_(item);
  const previous = previousFlow || (row ? getRowObject_(sheet, row) : {});
  const subject = buildFlowSubject_(item, payload);
  const updates = {
    'Flow ID': item['Flow ID'],
    'Flow Type': previous['Flow Type'] || item.Lane || inferLaneFromEventKey_(item['Event Key']),
    Subject: previous.Subject || subject,
    Owner: previous.Owner || item.Owner || payload.owner || '',
    'Flow Status': previous['Flow Status'] || 'Test Only',
    'Test Slack Channel': completion.testSlackChannel || previous['Test Slack Channel'] || '',
    'Test Anchor Message TS': completion.testAnchorMessageTs || previous['Test Anchor Message TS'] || '',
    'Test Thread TS': completion.testSlackThreadTs || previous['Test Thread TS'] || '',
    'Test Latest Reply TS': completion.testSlackMessageTs || previous['Test Latest Reply TS'] || '',
    'Test Anchor Message URL': completion.testAnchorMessageUrl || previous['Test Anchor Message URL'] || '',
    'Test Spotlight TS': completion.testSpotlightTs || previous['Test Spotlight TS'] || '',
    'Test Spotlight URL': completion.testSpotlightUrl || previous['Test Spotlight URL'] || '',
    'Updated At': nowIso_()
  };

  if (row) {
    updateRowFields_(sheet, row, updates);
    return;
  }

  insertObjectRowAtTop_(sheet, Object.assign({
    'Current Event Key': '',
    'Next Happy Event Key': '',
    'Allowed Detour Event Keys': '',
    'Return Event Key': '',
    'Slack Channel': '',
    'Anchor Message TS': '',
    'Thread TS': '',
    'Latest Reply TS': '',
    'Anchor Message URL': '',
    'Live Spotlight TS': '',
    'Live Spotlight URL': '',
    'Test Spotlight TS': '',
    'Test Spotlight URL': '',
    'Last Queue ID': '',
    'Last Confirmed At': '',
    'State JSON': ''
  }, updates));
}

function shouldAutoSendTestOnQueue_() {
  const raw = String(getScriptProperty_('AUTO_SEND_TEST_ON_QUEUE') || 'TRUE').trim().toUpperCase();
  return ['FALSE', 'NO', '0', 'OFF', 'DISABLED'].indexOf(raw) < 0;
}

function shouldAutoSendTestForDraft_(item, draftContext) {
  if (String(draftContext && draftContext['Suppress Auto Test Send'] || '').toUpperCase() === 'TRUE') return false;

  const payload = normalizePayload_(item || {});
  if (payload.suppress_test_send === true || String(payload.suppress_test_send || '').toUpperCase() === 'TRUE') return false;

  const source = String(item && item.Source || '').toLowerCase();
  if (source.indexOf('debug') >= 0 || source.indexOf('smoke') >= 0) return false;

  const sendRule = String(item && item['Send Rule'] || '').trim().toLowerCase();
  if (sendRule === 'log only') return false;

  const status = String(item && item.Status || '').trim();
  return [HUB.STATUS.DRAFT, HUB.STATUS.SCHEDULED].indexOf(status) >= 0;
}
