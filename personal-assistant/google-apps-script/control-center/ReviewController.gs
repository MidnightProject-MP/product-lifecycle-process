function openReviewController() {
  showReviewControllerWorkspace_('wide', {});
}

function openReviewControllerSidebar() {
  showReviewControllerWorkspace_('sidebar', {});
}

function expandReviewControllerWorkspace(form) {
  logReviewControllerEvent_('mode_switch', form || {}, { targetMode: 'wide' });
  showReviewControllerWorkspace_('wide', form || {});
  return {
    ok: true,
    mode: 'wide'
  };
}

function minimizeReviewControllerWorkspace(form) {
  logReviewControllerEvent_('mode_switch', form || {}, { targetMode: 'sidebar' });
  showReviewControllerWorkspace_('sidebar', form || {});
  return {
    ok: true,
    mode: 'sidebar'
  };
}

function getReviewControllerLaunchState() {
  const cached = CacheService.getUserCache().get('review_controller_launch_state');
  if (!cached) return buildReviewControllerLaunchState_('sidebar', {});

  try {
    const parsed = JSON.parse(cached);
    return buildReviewControllerLaunchState_(parsed.mode, parsed.form || {}, parsed.hasForm);
  } catch (error) {
    return buildReviewControllerLaunchState_('sidebar', {});
  }
}

function getReviewControllerInitialContext() {
  const launchState = getReviewControllerLaunchState();
  const form = launchState && launchState.form || {};
  const selection = form.selection || launchState.selection || '';
  logReviewControllerEvent_('load_initial', form, { selection: selection });
  return {
    ok: true,
    launchState: launchState,
    context: getReviewControllerContextForSelection_(selection)
  };
}

function logReviewControllerClientEvent(eventType, form, details) {
  logReviewControllerEvent_(eventType, form || {}, details || {});
  return {
    ok: true
  };
}

function showReviewControllerWorkspace_(mode, form) {
  const normalizedMode = mode === 'wide' ? 'wide' : 'sidebar';
  setReviewControllerLaunchState_(normalizedMode, form || {});
  const html = buildReviewControllerHtml_();

  if (normalizedMode === 'wide') {
    SpreadsheetApp.getUi().showModelessDialog(
      html.setWidth(860).setHeight(740),
      'Communication Console'
    );
    return;
  }

  SpreadsheetApp.getUi().showSidebar(html);
}

function buildReviewControllerHtml_() {
  return HtmlService.createHtmlOutputFromFile('ReviewControllerSidebar')
    .setTitle('Communication Console')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setReviewControllerLaunchState_(mode, form) {
  CacheService.getUserCache().put(
    'review_controller_launch_state',
    JSON.stringify(buildReviewControllerLaunchState_(mode, form, form && Object.keys(form).length > 0)),
    300
  );
}

function buildReviewControllerLaunchState_(mode, form, hasForm) {
  form = form || {};
  const launchForm = {
    selection: stringFromForm_(form.selection),
    queueId: stringFromForm_(form.queueId),
    flowId: stringFromForm_(form.flowId),
    flowAction: stringFromForm_(form.flowAction),
    eventKey: stringFromForm_(form.eventKey),
    subject: stringFromForm_(form.subject),
    messageTitle: stringFromForm_(form.messageTitle),
    messageTitleHtml: stringFromForm_(form.messageTitleHtml),
    messageBodyHtml: stringFromForm_(form.messageBodyHtml),
    what: stringFromForm_(form.what),
    soWhat: stringFromForm_(form.soWhat),
    whatsNext: stringFromForm_(form.whatsNext),
    owner: stringFromForm_(form.owner),
    priority: stringFromForm_(form.priority)
  };

  return {
    ok: true,
    mode: mode === 'wide' ? 'wide' : 'sidebar',
    hasForm: Boolean(hasForm),
    selection: launchForm.selection,
    form: launchForm
  };
}

function logReviewControllerEvent_(eventType, form, details) {
  const safeForm = form || {};
  logHub_('INFO', 'CommunicationConsole', safeForm.queueId || '', 'Communication Console event: ' + eventType, {
    eventType: eventType,
    selection: safeForm.selection || '',
    flowAction: safeForm.flowAction || '',
    eventKey: safeForm.eventKey || '',
    flowId: safeForm.flowId || '',
    mode: details && details.mode || '',
    targetMode: details && details.targetMode || '',
    error: details && details.error || '',
    missing: details && details.missing || ''
  });
}

function getReviewControllerContext(selection) {
  return getReviewControllerContextForSelection_(selection || '');
}

function saveReviewControllerDraft(form) {
  logReviewControllerEvent_('save_draft', form || {}, {});
  const result = runSkillOrThrow_('save_review_draft', {
    queueId: form && form.queueId,
    form: form || {}
  });

  return getReviewControllerContextForQueueId_(result.queueId);
}

function queueReviewControllerDraft(form) {
  logReviewControllerEvent_('queue_draft', form || {}, {});
  const parsed = parseReviewControllerSelection_(form && form.selection);
  const action = String(form && form.flowAction || '').trim();

  if (parsed.mode === 'new') {
    return createReviewControllerNewCommunicationDraft(form || {});
  }

  if (parsed.mode === 'flow') {
    return createReviewControllerFlowActionDraft(form || {});
  }

  if (action && action !== 'selected') {
    return createReviewControllerFlowActionDraft(form || {});
  }

  return saveReviewControllerDraft(form || {});
}

function approveReviewControllerDraft(form) {
  logReviewControllerEvent_('approve_draft', form || {}, {});
  const result = runSkillOrThrow_('approve_draft', {
    queueId: form && form.queueId,
    form: form || {}
  });

  return {
    ok: true,
    message: 'Approved and sent. Queue ID: ' + result.queueId,
    queueId: result.queueId
  };
}

function approveReviewControllerSelection(form) {
  logReviewControllerEvent_('approve_selection', form || {}, {});
  const parsed = parseReviewControllerSelection_(form && form.selection);
  const action = String(form && form.flowAction || '').trim();
  if (parsed.mode === 'new' || parsed.mode === 'flow' || (action && action !== 'selected')) {
    const queued = parsed.mode === 'new' ?
      createReviewControllerNewCommunicationDraft(form || {}) :
      createReviewControllerFlowActionDraft(form || {});
    if (!queued || !queued.ok || !queued.queue || !queued.queue.queueId) {
      throw new Error('Unable to queue chosen action before approval.');
    }
    const approveForm = Object.assign({}, form || {}, {
      queueId: queued.queue.queueId,
      flowAction: 'selected'
    });
    return approveReviewControllerDraft(approveForm);
  }

  return approveReviewControllerDraft(form || {});
}

function sendReviewControllerTest(form) {
  logReviewControllerEvent_('send_test', form || {}, {});
  const queueForm = Object.assign({}, form || {}, {
    suppressAutoTestSend: 'TRUE'
  });
  const queued = queueReviewControllerDraft(queueForm);
  if (!queued || !queued.ok || !queued.queue || !queued.queue.queueId) {
    throw new Error('Unable to queue or save the selected draft before test send.');
  }

  const result = runSkillOrThrow_('send_test_slack_message', {
    queueId: queued.queue.queueId,
    source: 'Communication Console'
  });
  const context = getReviewControllerContextForQueueId_(queued.queue.queueId);
  context.message = 'Test sent to Slack. Queue ID: ' + queued.queue.queueId;
  context.testSend = result;
  return context;
}

function discardReviewControllerDraft(form) {
  logReviewControllerEvent_('discard_draft', form || {}, {});
  const reason = form && form.discardReason ? String(form.discardReason) : 'Discarded from Communication Console.';
  const result = runSkillOrThrow_('discard_draft', {
    queueId: form && form.queueId,
    reason: reason
  });

  return {
    ok: true,
    message: 'Discarded. Queue ID: ' + result.queueId,
    queueId: result.queueId
  };
}

function syncDashboardFromCommunicationConsole(form) {
  logReviewControllerEvent_('manual_dashboard_sync_started', form || {}, {});
  const result = runControlCenterDashboardSync_();
  const message = buildCommunicationConsoleSyncMessage_(result);
  logReviewControllerEvent_('manual_dashboard_sync_completed', form || {}, {
    mode: result.syncMode || '',
    error: result.ok === false ? result.message || 'Dashboard sync failed.' : ''
  });
  return {
    ok: result.ok !== false,
    message: message,
    result: result
  };
}

function createReviewControllerFlowActionDraft(form) {
  const parsed = parseReviewControllerSelection_(form && form.selection);
  const useFlowOnlyContext = parsed.mode === 'flow' || (form && form.flowId && !form.selection);
  if (useFlowOnlyContext) {
    const flowId = parsed.id || form.flowId;
    const flow = findFlowStateByFlowId_(flowId);
    if (!flow) throw new Error('Flow not found in Flow_State: ' + flowId);
    return getReviewControllerContextForQueueId_(createReviewControllerFlowActionDraftForFlow_(form || {}, flow, buildReviewControllerItemFromFlow_(flow)));
  }

  const result = withReviewControllerQueueRow_(form && form.queueId, function(queueSheet, row) {
    const selectedItem = getRowObject_(queueSheet, row);
    const flowId = selectedItem['Flow ID'];
    if (!flowId) throw new Error('Selected draft does not belong to a flow yet.');

    const flow = findFlowStateByFlowId_(flowId);
    if (!flow) throw new Error('Flow not found in Flow_State: ' + flowId);

    return createReviewControllerFlowActionDraftForFlow_(form || {}, flow, selectedItem);
  });

  return getReviewControllerContextForQueueId_(result.queueId);
}

function previewReviewControllerMessage(form) {
  try {
    const item = buildReviewControllerPreviewItem_(form || {});
    const template = findReviewControllerTemplateForPreview_(item);
    const existingFlow = item['Flow ID'] ? findFlowStateByFlowId_(item['Flow ID']) : null;
    const anchorText = renderTemplate_(getTemplateAnchorText_(template), item);
    const replyText = renderTemplate_(getTemplateReplyText_(template), item);
    const historyText = replyText || buildThreadHistoryText_(item, template, 'Preview');
    const previewText = anchorText || historyText;
    const previewMode = existingFlow && shouldUpdateAnchorMessage_(template, item) ? 'Anchor update' : 'Anchor';
    return {
      ok: true,
      previewText: previewText,
      previewMode: previewMode,
      anchorText: anchorText,
      replyText: historyText,
      templateKey: template['Template Key'],
      eventName: getReviewControllerEventDisplayName_(item['Event Key']),
      diagnostics: buildReviewControllerPreviewDiagnostics_(item, template, historyText)
    };
  } catch (error) {
    logReviewControllerEvent_('preview_error', form || {}, {
      error: error.message || String(error)
    });
    return {
      ok: false,
      message: error.message || String(error)
    };
  }
}

function runControlCenterDashboardSync_() {
  const result = syncLeadershipDashboardToAutomation();
  if (!result || result.ok === false) {
    throw new Error(result && (result.message || result.error) ? result.message || result.error : 'Dashboard sync failed.');
  }
  return result;
}

function buildCommunicationConsoleSyncMessage_(result) {
  const parts = [];
  parts.push('Dashboard sync: ' + (result.syncMode || 'Complete'));
  if (result.changedRows != null) parts.push('changed ' + result.changedRows);
  if (result.hubDraftsCreated != null) parts.push('drafts ' + result.hubDraftsCreated);
  if (result.pendingEvaluations != null) parts.push('pending ' + result.pendingEvaluations);
  if (result.skippedRows != null) parts.push('skipped ' + result.skippedRows);
  if (result.errors != null) parts.push('errors ' + result.errors);
  return parts.join(' | ');
}

function buildReviewControllerFinalMessage_(item) {
  const payload = normalizePayload_(item);
  if (payload.message_title_mrkdwn || payload.message_body_mrkdwn) {
    const titleText = payload.message_title || cleanReviewControllerTitle_(payload.message_title_mrkdwn);
    return {
      title: titleText,
      titleHtml: reviewControllerSlackInlineToHtml_(payload.message_title_mrkdwn || titleText),
      bodyHtml: slackTextToReviewControllerHtml_(payload.message_body_mrkdwn || '')
    };
  }

  if (payload.message_title || payload.message_title_html || payload.message_body_html) {
    return {
      title: stripHtml_(payload.message_title_html || payload.message_title || getReviewControllerSubject_(item, payload)),
      titleHtml: payload.message_title_html || reviewControllerPlainTextToHtml_(payload.message_title || getReviewControllerSubject_(item, payload)),
      bodyHtml: String(payload.message_body_html || '')
    };
  }

  try {
    const template = findReviewControllerTemplateForPreview_(item);
    const rendered = renderTemplate_(getTemplateAnchorText_(template), item);
    return splitRenderedMessageForEditor_(rendered, getReviewControllerSubject_(item, payload) || getReviewControllerEventDisplayName_(item['Event Key']));
  } catch (error) {
    return buildFallbackReviewControllerFinalMessage_(item, payload);
  }
}

function buildFallbackReviewControllerFinalMessage_(item, payload) {
  const title = getReviewControllerSubject_(item, payload) || getReviewControllerEventDisplayName_(item['Event Key']);
  const lines = [
    payload.what || '',
    payload.so_what || '',
    payload.whats_next || ''
  ].filter(Boolean);
  return {
    title: title,
    titleHtml: reviewControllerPlainTextToHtml_(title),
    bodyHtml: reviewControllerPlainTextToHtml_(lines.join('\n\n'))
  };
}

function splitRenderedMessageForEditor_(text, fallbackTitle) {
  const lines = String(text || '').replace(/\\n/g, '\n').split(/\n/);
  let title = '';
  const bodyLines = [];

  lines.forEach(line => {
    if (!title && String(line || '').trim()) {
      title = cleanReviewControllerTitle_(line);
      return;
    }
    bodyLines.push(line);
  });

  return {
    title: title || fallbackTitle || '',
    titleHtml: reviewControllerSlackInlineToHtml_(title || fallbackTitle || ''),
    bodyHtml: slackTextToReviewControllerHtml_(bodyLines.join('\n').trim())
  };
}

function cleanReviewControllerTitle_(line) {
  return decodeHtmlEntities_(
    String(line || '')
      .replace(/^[\s>*\u2022-]+/, '')
      .replace(/\*/g, '')
      .replace(/_/g, '')
      .trim()
  );
}

function slackTextToReviewControllerHtml_(text) {
  const lines = String(text || '').split(/\n/);
  const html = [];
  let listType = '';

  lines.forEach(rawLine => {
    const line = String(rawLine || '').trim();
    if (!line) {
      if (listType) {
        html.push('</' + listType + '>');
        listType = '';
      }
      return;
    }

    const bullet = line.match(/^[-\u2022]\s+(.+)$/);
    if (bullet) {
      if (listType !== 'ul') {
        if (listType) html.push('</' + listType + '>');
        html.push('<ul>');
        listType = 'ul';
      }
      html.push('<li>' + reviewControllerSlackInlineToHtml_(bullet[1]) + '</li>');
      return;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      if (listType !== 'ol') {
        if (listType) html.push('</' + listType + '>');
        html.push('<ol>');
        listType = 'ol';
      }
      html.push('<li>' + reviewControllerSlackInlineToHtml_(numbered[1]) + '</li>');
      return;
    }

    if (listType) {
      html.push('</' + listType + '>');
      listType = '';
    }
    html.push('<p>' + reviewControllerSlackInlineToHtml_(line) + '</p>');
  });

  if (listType) html.push('</' + listType + '>');
  return html.join('');
}

function reviewControllerPlainTextToHtml_(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(paragraph => '<p>' + escapeReviewControllerHtml_(paragraph).replace(/\n/g, '<br>') + '</p>')
    .join('');
}

function reviewControllerSlackInlineToHtml_(text) {
  return escapeReviewControllerHtml_(text)
    .replace(/&lt;([^|]+)\|([^&]+)&gt;/g, '<a href="$1">$2</a>')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function escapeReviewControllerHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findReviewControllerTemplateForPreview_(item) {
  const template = findTemplate_(item);
  const eventKey = item['Event Key'] || normalizePayload_(item).event_key || '';
  const expectedTemplateKey = getExpectedReviewControllerTemplateKey_(eventKey);
  const actualTemplateKey = template['Template Key'] || '';
  if (!expectedTemplateKey || expectedTemplateKey === actualTemplateKey) return template;

  const expectedTemplate = findActiveReviewControllerTemplateByKey_(expectedTemplateKey);
  if (!expectedTemplate) return template;

  return Object.assign({}, expectedTemplate, {
    'Event Key': template['Event Key'] || eventKey,
    'Channel Type': template['Channel Type'],
    'Default Send Rule': template['Default Send Rule'],
    'Post Mode': template['Post Mode'],
    'Anchor Update Policy': template['Anchor Update Policy'],
    'Thread Reply Policy': template['Thread Reply Policy'],
    'Reply Broadcast': template['Reply Broadcast'],
    '_Registry Template Key': actualTemplateKey
  });
}

function findActiveReviewControllerTemplateByKey_(templateKey) {
  const templates = getRegistryObjects_('Templates').filter(row =>
    row['Template Key'] === templateKey &&
    String(row.Active || '').toUpperCase() !== 'FALSE'
  );
  return templates.length ? templates[templates.length - 1] : null;
}

function createReviewControllerFlowActionDraftForFlow_(form, flow, selectedItem) {
  const flowId = flow['Flow ID'];
  const action = String(form && form.flowAction || '').trim();
  if (!action || action === 'selected') {
    throw new Error('Choose an expected path or detour action first.');
  }

  const eventKey = resolveFlowConsoleEventKey_(flow, action);
  if (!eventKey) throw new Error('No event could be resolved for action: ' + action);

  const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  if (!event) throw new Error('Registry is missing Event_Catalog row for: ' + eventKey);

  const values = buildReviewControllerFlowValues_(form || {}, selectedItem || buildReviewControllerItemFromFlow_(flow));
  const payload = buildFlowConsolePayload_(flow, values, eventKey);
  applyReviewControllerFinalMessageToPayload_(payload, form || {});
  const priority = values.Priority || event.Severity || selectedItem && selectedItem.Priority || 'Medium';
  const draft = {
    Source: 'Communication Console',
    Lane: flow['Flow Type'] || event.Lane || inferLaneFromEventKey_(eventKey),
    'Event Key': eventKey,
    Status: HUB.STATUS.DRAFT,
    Priority: priority,
    Owner: values.Owner || flow.Owner || payload.owner || '',
    'Flow ID': flowId,
    'Dedupe Key': buildFlowConsoleDedupeKey_(flow, eventKey, payload),
    'Parent Queue ID': flow['Last Queue ID'] || selectedItem && selectedItem['Queue ID'] || '',
    'Expected Previous Event Key': flow['Current Event Key'] || '',
    'Path Override': action === HUB.FLOW_ACTION.CONTINUE ? 'Happy Path' : 'Sad Path',
    'Suppress Auto Test Send': String(form && form.suppressAutoTestSend || '').toUpperCase() === 'TRUE' ? 'TRUE' : '',
    'Payload JSON': stringifyJson_(payload)
  };

  const queueId = upsertFlowConsoleDraft_(draft);
  if (action !== HUB.FLOW_ACTION.CONTINUE) {
    archiveScheduledDraftsForFlowExceptEvent_(flowId, eventKey, 'Superseded by Communication Console detour draft ' + queueId);
  }
  syncReviewSheetFromQueueSafe_();
  logHub_('INFO', 'createReviewControllerFlowActionDraft', queueId, 'Communication Console created flow action draft.', {
    flowId: flowId,
    action: action,
    eventKey: eventKey
  });
  return queueId;
}

function createReviewControllerNewCommunicationDraft(form) {
  const eventKey = resolveCanonicalEventKey_(form && (form.eventKey || form.startEventKey || form.flowAction) || '', '');
  if (!eventKey) throw new Error('Choose a communication type first.');

  const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  if (!event) throw new Error('Registry is missing Event_Catalog row for: ' + eventKey);

  const lane = event.Lane || inferLaneFromEventKey_(eventKey);
  const messageTitleHtml = stringFromForm_(form.messageTitleHtml);
  const messageTitle = stringFromForm_(form.messageTitle) || stripHtml_(messageTitleHtml);
  const messageBodyHtml = stringFromForm_(form.messageBodyHtml);
  const messageTitleMrkdwn = htmlToSlackText_(messageTitleHtml || messageTitle).trim();
  const messageBodyMrkdwn = htmlToSlackText_(messageBodyHtml).trim();
  const payload = {
    event_key: eventKey,
    lane: lane,
    subject: stringFromForm_(form.subject) || messageTitle,
    owner: stringFromForm_(form.owner),
    what: stringFromForm_(form.what) || messageTitle,
    so_what: stringFromForm_(form.soWhat) || messageBodyMrkdwn,
    whats_next: stringFromForm_(form.whatsNext),
    message_title: messageTitle,
    message_title_mrkdwn: messageTitleMrkdwn || messageTitle,
    message_body_mrkdwn: messageBodyMrkdwn,
    message_format: 'mrkdwn_v1',
    priority: event.Severity || 'Medium'
  };
  applyReviewControllerAiMetadataToPayload_(payload, form || {});
  if (!payload.message_title) throw new Error('Add a title before queueing a new communication.');
  if (!payload.message_body_mrkdwn) throw new Error('Add a body before queueing a new communication.');

  const draft = {
    Source: 'Communication Console',
    Lane: lane,
    'Event Key': eventKey,
    Status: HUB.STATUS.DRAFT,
    Priority: payload.priority,
    Owner: payload.owner,
    'Suppress Auto Test Send': String(form && form.suppressAutoTestSend || '').toUpperCase() === 'TRUE' ? 'TRUE' : '',
    'Payload JSON': stringifyJson_(payload)
  };
  draft['Flow ID'] = buildFlowId_(draft);
  draft['Dedupe Key'] = buildDedupeKey_(draft);

  const queueId = insertQueueDraftAtTop_(draft);
  logHub_('INFO', 'createReviewControllerNewCommunicationDraft', queueId, 'Communication Console created new communication draft.', {
    eventKey: eventKey,
    lane: lane
  });
  return getReviewControllerContextForQueueId_(queueId);
}

function getReviewControllerContextForQueueId_(queueId) {
  return getReviewControllerContextForSelection_(queueId ? 'queue:' + queueId : '');
}

function getReviewControllerContextForSelection_(selection) {
  try {
    const options = buildReviewControllerCommunicationOptions_();
    const selectedValue = resolveReviewControllerSelectedValue_(selection, options);
    const parsed = parseReviewControllerSelection_(selectedValue);
    if (parsed.mode === 'new') return buildReviewControllerNewContext_(options, selectedValue);
    if (parsed.mode === 'flow') return buildReviewControllerFlowOnlyContext_(parsed.id, options, selectedValue);
    return buildReviewControllerQueueContext_(parsed.id, options, selectedValue);
  } catch (error) {
    return {
      ok: false,
      message: error.message || String(error)
    };
  }
}

function buildReviewControllerQueueContext_(queueId, communicationOptions, selectedValue) {
  const resolved = resolveReviewControllerSelection_(queueId);
    const queueSheet = resolved.queueSheet;
    const row = resolved.row;
    const item = getRowObject_(queueSheet, row);
    const payload = normalizePayload_(item);
    const finalMessage = buildReviewControllerFinalMessage_(item);
    const flow = findFlowStateByFlowId_(item['Flow ID']);

    return {
      ok: true,
      mode: 'queue',
      communications: communicationOptions,
      selectedCommunication: selectedValue,
      selection: {
        sourceSheet: resolved.sourceSheet,
        row: resolved.sourceRow,
        queueRow: row
      },
      queue: {
        queueId: item['Queue ID'],
        flowId: item['Flow ID'] || '',
        eventKey: item['Event Key'] || '',
        eventName: getReviewControllerEventDisplayName_(item['Event Key']),
        lane: item.Lane || '',
        status: item.Status || '',
        source: item.Source || '',
        priority: item.Priority || '',
        createdAt: item['Created At'] || '',
        updatedAt: item['Updated At'] || '',
        scheduledFor: item['Scheduled For'] || '',
        sendRule: item['Send Rule'] || '',
        channelOverride: item['Channel Override'] || '',
        owner: item.Owner || payload.owner || '',
        subject: getReviewControllerSubject_(item, payload),
        messageTitle: finalMessage.title,
        messageTitleHtml: finalMessage.titleHtml,
        messageBodyHtml: finalMessage.bodyHtml,
        what: payload.what || '',
        soWhat: payload.so_what || '',
        whatsNext: payload.whats_next || '',
        slackUrl: item['Slack Message URL'] || '',
        testSlackUrl: item['Test Slack Message URL'] || '',
        testSlackChannel: item['Test Slack Channel'] || '',
        testSlackThreadTs: item['Test Slack Thread TS'] || '',
        testSlackMessageTs: item['Test Slack Message TS'] || '',
        testSentAt: item['Test Sent At'] || '',
        error: item.Error || ''
      },
      flow: buildReviewControllerFlowContext_(flow),
      actions: buildReviewControllerActions_(item, flow, { includeSelected: true }),
      message: ''
    };
}

function buildReviewControllerFlowOnlyContext_(flowId, communicationOptions, selectedValue) {
  const flow = findFlowStateByFlowId_(flowId);
  if (!flow) throw new Error('Flow not found in Flow_State: ' + flowId);
  const item = buildReviewControllerItemFromFlow_(flow);
  const payload = normalizePayload_(item);
  const finalMessage = buildReviewControllerFinalMessage_(item);
  return {
    ok: true,
    mode: 'flow',
    communications: communicationOptions,
    selectedCommunication: selectedValue,
    selection: {
      sourceSheet: HUB.SHEETS.FLOW_STATE,
      row: 0,
      queueRow: 0
    },
    queue: {
      queueId: '',
      flowId: flowId,
      eventKey: flow['Current Event Key'] || '',
      eventName: getReviewControllerEventDisplayName_(flow['Current Event Key']),
      lane: flow['Flow Type'] || '',
      status: flow['Flow Status'] || '',
      source: 'Flow_State',
      priority: payload.priority || '',
      createdAt: '',
      updatedAt: flow['Updated At'] || '',
      scheduledFor: '',
      sendRule: '',
      channelOverride: '',
      owner: flow.Owner || payload.owner || '',
      subject: flow.Subject || payload.subject || flowId,
      messageTitle: finalMessage.title,
      messageTitleHtml: finalMessage.titleHtml,
      messageBodyHtml: finalMessage.bodyHtml,
      what: payload.what || '',
      soWhat: payload.so_what || '',
      whatsNext: payload.whats_next || '',
      slackUrl: flow['Anchor Message URL'] || '',
      testSlackUrl: flow['Test Anchor Message URL'] || '',
      testSlackChannel: flow['Test Slack Channel'] || '',
      testSlackThreadTs: flow['Test Thread TS'] || '',
      testSlackMessageTs: flow['Test Latest Reply TS'] || '',
      testSentAt: '',
      error: ''
    },
    flow: buildReviewControllerFlowContext_(flow),
    actions: buildReviewControllerActions_(item, flow, { includeSelected: false }),
    message: ''
  };
}

function buildReviewControllerNewContext_(communicationOptions, selectedValue) {
  const startEvents = buildReviewControllerStartEventActions_(selectedValue);
  return {
    ok: true,
    mode: 'new',
    communications: communicationOptions,
    selectedCommunication: selectedValue,
    selection: {
      sourceSheet: '',
      row: 0,
      queueRow: 0
    },
    queue: {
      queueId: '',
      flowId: '',
      eventKey: '',
      eventName: '',
      lane: '',
      status: 'New',
      source: 'Communication Console',
      priority: '',
      createdAt: '',
      updatedAt: '',
      scheduledFor: '',
      sendRule: '',
      channelOverride: '',
      owner: '',
      subject: '',
      messageTitle: '',
      messageTitleHtml: '',
      messageBodyHtml: '',
      what: '',
      soWhat: '',
      whatsNext: '',
      slackUrl: '',
      testSlackUrl: '',
      testSlackChannel: '',
      testSlackThreadTs: '',
      testSlackMessageTs: '',
      testSentAt: '',
      error: ''
    },
    flow: buildReviewControllerFlowContext_(null),
    actions: startEvents,
    message: 'Choose a communication type.'
  };
}

function buildReviewControllerCommunicationOptions_() {
  const ss = SpreadsheetApp.getActive();
  const options = buildReviewControllerNewCommunicationOptions_();

  const queueSheet = ss.getSheetByName(HUB.SHEETS.QUEUE);
  const activeFlowIds = {};
  if (queueSheet) {
    getObjects_(queueSheet)
      .filter(isActiveReviewControllerDraft_)
      .forEach(row => {
        const payload = normalizePayload_(row);
        const subject = getReviewControllerSubject_(row, payload);
        if (row['Flow ID']) activeFlowIds[String(row['Flow ID'])] = true;
        options.push({
          value: 'queue:' + row['Queue ID'],
          label: 'Draft: ' + subject + ' - ' + getReviewControllerEventDisplayName_(row['Event Key'])
        });
      });
  }

  const flowSheet = ss.getSheetByName(HUB.SHEETS.FLOW_STATE);
  if (flowSheet) {
    getObjects_(flowSheet)
      .filter(row => shouldShowReviewControllerFlowOption_(row, activeFlowIds))
      .forEach(row => {
        const subject = row.Subject || row['Flow ID'];
        options.push({
          value: 'flow:' + row['Flow ID'],
          label: 'Continue: ' + subject + ' - ' + getReviewControllerEventDisplayName_(row['Current Event Key'])
        });
      });
  }

  return options;
}

function isActiveReviewControllerDraft_(row) {
  return [HUB.STATUS.DRAFT, HUB.STATUS.SCHEDULED, HUB.STATUS.ERROR].indexOf(String(row.Status || '').trim()) >= 0;
}

function shouldShowReviewControllerFlowOption_(flow, activeFlowIds) {
  const flowId = String(flow && flow['Flow ID'] || '');
  if (!flowId) return false;
  if (activeFlowIds && activeFlowIds[flowId]) return false;

  const status = String(flow['Flow Status'] || '').trim().toLowerCase();
  if (status === 'completed' || status === 'discarded' || status === 'test only') return false;

  const subject = String(flow.Subject || '');
  if (flowId.indexOf('debug-') === 0 || subject.toLowerCase().indexOf('smoke test') >= 0) return false;

  return true;
}

function resolveReviewControllerSelectedValue_(selection, options) {
  const requested = String(selection || '').trim();
  if (requested && options.some(option => option.value === requested)) return requested;

  const ss = SpreadsheetApp.getActive();
  const selectedQueueId = getQueueIdFromActiveReviewControllerSelection_(ss);
  if (selectedQueueId) {
    const queueSelection = 'queue:' + selectedQueueId;
    if (options.some(option => option.value === queueSelection)) return queueSelection;
  }

  return 'new:project';
}

function parseReviewControllerSelection_(selection) {
  const value = String(selection || '').trim();
  if (!value || value === 'new') return { mode: 'new', id: '' };
  if (value.indexOf('new:') === 0) return { mode: 'new', id: value.slice(4) };
  if (value.indexOf('queue:') === 0) return { mode: 'queue', id: value.slice(6) };
  if (value.indexOf('flow:') === 0) return { mode: 'flow', id: value.slice(5) };
  return { mode: 'queue', id: value };
}

function withReviewControllerQueueRow_(queueId, callback) {
  const resolved = resolveReviewControllerSelection_(queueId);
  return {
    queueId: callback(resolved.queueSheet, resolved.row),
    row: resolved.row
  };
}

function resolveReviewControllerSelection_(queueId) {
  const ss = SpreadsheetApp.getActive();
  const queueSheet = ensureSheet_(ss, HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
  const selectedQueueId = queueId || getQueueIdFromActiveReviewControllerSelection_(ss);
  if (!selectedQueueId) {
    throw new Error('Select a draft row in Review or Queue first.');
  }

  const row = findQueueRowByQueueId_(queueSheet, selectedQueueId);
  if (!row) {
    throw new Error('Queue item is no longer active: ' + selectedQueueId);
  }

  const activeSheet = ss.getActiveSheet();
  const activeRange = activeSheet ? activeSheet.getActiveRange() : null;
  return {
    queueSheet: queueSheet,
    row: row,
    sourceSheet: activeSheet ? activeSheet.getName() : '',
    sourceRow: activeRange ? activeRange.getRow() : 0
  };
}

function getQueueIdFromActiveReviewControllerSelection_(ss) {
  const sheet = ss.getActiveSheet();
  const range = sheet ? sheet.getActiveRange() : null;
  if (!sheet || !range || range.getRow() === 1) return '';

  const headers = getHeaders_(sheet);
  const queueIdColumn = headers.indexOf('Queue ID') + 1;
  if (queueIdColumn < 1) return '';

  return sheet.getRange(range.getRow(), queueIdColumn).getValue();
}

function updateQueueDraftFromReviewControllerForm_(queueSheet, row, form) {
  const item = getRowObject_(queueSheet, row);
  const payload = normalizePayload_(item);
  const messageTitleHtml = reviewControllerFormValue_(form, 'messageTitleHtml', payload.message_title_html || reviewControllerPlainTextToHtml_(payload.message_title || payload.subject || ''));
  const messageTitle = reviewControllerFormValue_(form, 'messageTitle', payload.message_title || stripHtml_(messageTitleHtml) || payload.subject || '');
  const messageBodyHtml = reviewControllerFormValue_(form, 'messageBodyHtml', payload.message_body_html || '');
  const messageTitleMrkdwn = htmlToSlackText_(messageTitleHtml || messageTitle).trim();
  const messageBodyMrkdwn = htmlToSlackText_(messageBodyHtml).trim();

  if (messageTitle || messageTitleHtml || messageBodyHtml) {
    payload.message_title = messageTitle;
    payload.message_title_mrkdwn = messageTitleMrkdwn || messageTitle;
    payload.message_body_mrkdwn = messageBodyMrkdwn;
    payload.message_format = 'mrkdwn_v1';
    delete payload.message_title_html;
    delete payload.message_body_html;
  }
  applyReviewControllerAiMetadataToPayload_(payload, form);
  payload.subject = stringFromForm_(form.subject) || payload.subject || messageTitle || '';
  if (Object.prototype.hasOwnProperty.call(form || {}, 'what')) payload.what = stringFromForm_(form.what);
  if (Object.prototype.hasOwnProperty.call(form || {}, 'soWhat')) payload.so_what = stringFromForm_(form.soWhat);
  if (Object.prototype.hasOwnProperty.call(form || {}, 'whatsNext')) payload.whats_next = stringFromForm_(form.whatsNext);
  if (!payload.what && messageTitle) payload.what = messageTitle;
  if (!payload.so_what && messageBodyHtml) payload.so_what = htmlToSlackText_(messageBodyHtml);
  payload.owner = stringFromForm_(form.owner) || payload.owner || item.Owner || '';
  payload.priority = stringFromForm_(form.priority) || payload.priority || item.Priority || '';

  const updates = {
    'Payload JSON': stringifyJson_(payload),
    Owner: payload.owner,
    Priority: payload.priority || item.Priority || '',
    'Updated At': nowIso_(),
    Error: ''
  };
  if (item.Status === HUB.STATUS.ERROR) updates.Status = HUB.STATUS.DRAFT;

  updateRowFields_(queueSheet, row, updates);
  return item['Queue ID'];
}

function applyReviewControllerFinalMessageToPayload_(payload, form) {
  const messageTitleHtml = stringFromForm_(form && form.messageTitleHtml);
  const messageTitle = stringFromForm_(form && form.messageTitle) || stripHtml_(messageTitleHtml);
  const messageBodyHtml = stringFromForm_(form && form.messageBodyHtml);
  const messageTitleMrkdwn = htmlToSlackText_(messageTitleHtml || messageTitle).trim();
  const messageBodyMrkdwn = htmlToSlackText_(messageBodyHtml).trim();
  if (!messageTitle && !messageTitleHtml && !messageBodyHtml) return payload;

  payload.message_title = messageTitle;
  payload.message_title_mrkdwn = messageTitleMrkdwn || messageTitle;
  payload.message_body_mrkdwn = messageBodyMrkdwn;
  payload.message_format = 'mrkdwn_v1';
  delete payload.message_title_html;
  delete payload.message_body_html;
  if (messageTitle && !payload.subject) payload.subject = messageTitle;
  if (messageTitle && !payload.what) payload.what = messageTitle;
  if (messageBodyMrkdwn && !payload.so_what) payload.so_what = messageBodyMrkdwn;
  applyReviewControllerAiMetadataToPayload_(payload, form);
  return payload;
}

function applyReviewControllerAiMetadataToPayload_(payload, form) {
  form = form || {};
  if (Object.prototype.hasOwnProperty.call(form, 'aiModel')) payload.message_ai_model = stringFromForm_(form.aiModel);
  if (Object.prototype.hasOwnProperty.call(form, 'aiGeneratedAt')) payload.message_ai_generated_at = stringFromForm_(form.aiGeneratedAt);
  if (Object.prototype.hasOwnProperty.call(form, 'aiRedraftedAt')) payload.message_ai_redrafted_at = stringFromForm_(form.aiRedraftedAt);
  return payload;
}

function buildReviewControllerFlowValues_(form, item) {
  return {
    'What changed?': stringFromForm_(form.messageTitle) || stringFromForm_(form.what) || normalizePayload_(item).what || '',
    'Why it matters': htmlToSlackText_(form.messageBodyHtml || '') || stringFromForm_(form.soWhat) || normalizePayload_(item).so_what || '',
    'What happens next?': stringFromForm_(form.whatsNext) || normalizePayload_(item).whats_next || '',
    Owner: stringFromForm_(form.owner) || item.Owner || '',
    Priority: stringFromForm_(form.priority) || item.Priority || 'Medium'
  };
}

function buildReviewControllerFlowContext_(flow) {
  if (!flow) {
    return {
      exists: false,
      subject: '',
      currentState: 'No active parent flow yet',
      expectedNext: '',
      availableDetours: '',
      anchorUrl: '',
      slackChannel: '',
      threadTs: '',
      latestReplyTs: '',
      testAnchorUrl: '',
      testSlackChannel: '',
      testThreadTs: '',
      testLatestReplyTs: '',
      lastQueueId: '',
      lastConfirmedAt: '',
      updatedAt: ''
    };
  }

  return {
    exists: true,
    flowId: flow['Flow ID'] || '',
    subject: flow.Subject || flow['Flow ID'] || '',
    currentState: getReviewControllerEventDisplayName_(flow['Current Event Key']),
    expectedNext: flow['Next Happy Event Key'] ? getReviewControllerEventDisplayName_(flow['Next Happy Event Key']) : 'No expected next step',
    availableDetours: describeReviewControllerEventKeyList_(getFlowAllowedDetourEventKeys_(flow)),
    anchorUrl: flow['Anchor Message URL'] || '',
    status: flow['Flow Status'] || '',
    slackChannel: flow['Slack Channel'] || '',
    threadTs: flow['Thread TS'] || '',
    latestReplyTs: flow['Latest Reply TS'] || '',
    testAnchorUrl: flow['Test Anchor Message URL'] || '',
    testSlackChannel: flow['Test Slack Channel'] || '',
    testThreadTs: flow['Test Thread TS'] || '',
    testLatestReplyTs: flow['Test Latest Reply TS'] || '',
    lastQueueId: flow['Last Queue ID'] || '',
    lastConfirmedAt: flow['Last Confirmed At'] || '',
    updatedAt: flow['Updated At'] || ''
  };
}

function buildReviewControllerActions_(item, flow, options) {
  options = options || {};
  const selectedDefaults = buildReviewControllerSelectedDefaults_(item);
  const actions = [];
  if (options.includeSelected !== false) {
    actions.push({
      value: 'selected',
      label: 'Use selected draft: ' + getReviewControllerEventDisplayName_(item['Event Key']),
      eventKey: item['Event Key'] || '',
      defaults: selectedDefaults
    });
  }

  if (!flow) return actions;

  getAvailableFlowConsoleActions_(flow).forEach(action => {
    const eventKey = resolveFlowConsoleEventKey_(flow, action);
    if (!eventKey) return;
    const defaults = buildReviewControllerActionDefaults_(item, flow, eventKey, action);
    actions.push({
      value: action,
      label: action + ': ' + getReviewControllerEventDisplayName_(eventKey),
      eventKey: eventKey,
      defaults: enrichReviewControllerDefaultsWithFinalMessage_(defaults, item, flow, eventKey)
    });
  });

  return actions.filter((action, index, list) =>
    list.findIndex(candidate => candidate.value === action.value && candidate.eventKey === action.eventKey) === index
  );
}

function buildReviewControllerStartEventActions_(selectedValue) {
  const cachedRows = getReviewControllerCachedRegistryRows_('Event_Catalog');
  const eventRows = cachedRows.length ? cachedRows : getFallbackReviewControllerStartEventRows_();
  const selectedType = getReviewControllerNewTypeFromSelection_(selectedValue);
  return eventRows
    .filter(row => String(row.Active || 'TRUE').toUpperCase() !== 'FALSE')
    .filter(row => String(row.Path || '').toLowerCase() === 'start')
    .filter(row => !selectedType || getReviewControllerNewTypeForEventKey_(row['Event Key']) === selectedType)
    .map(row => {
      const eventKey = row['Event Key'];
      const defaults = buildReviewControllerNewStartDefaults_(eventKey);
      return {
        value: 'new_start:' + eventKey,
        label: row.Lane + ': ' + (row['Communication Event'] || getReviewControllerEventDisplayName_(eventKey)),
        eventKey: eventKey,
        defaults: enrichReviewControllerDefaultsWithFinalMessage_(defaults, {
          'Event Key': eventKey,
          Lane: row.Lane || inferLaneFromEventKey_(eventKey),
          'Payload JSON': stringifyJson_(Object.assign({
            event_key: eventKey,
            lane: row.Lane || inferLaneFromEventKey_(eventKey),
            subject: '',
            owner: ''
          }, defaults))
        }, null, eventKey)
      };
    });
}

function buildReviewControllerNewCommunicationOptions_() {
  return [
    {
      value: 'new:project',
      label: '+ New Project communication'
    },
    {
      value: 'new:release',
      label: '+ New Release communication'
    },
    {
      value: 'new:incident',
      label: '+ New Critical Incident'
    },
    {
      value: 'new:stray',
      label: '+ New Stray Story'
    }
  ];
}

function getReviewControllerNewTypeFromSelection_(selection) {
  const parsed = parseReviewControllerSelection_(selection);
  return parsed.mode === 'new' ? parsed.id : '';
}

function getReviewControllerNewTypeForEventKey_(eventKey) {
  const key = String(eventKey || '');
  if (key.indexOf('project.') === 0) return 'project';
  if (key.indexOf('release.') === 0) return 'release';
  if (key.indexOf('incident.') === 0) return 'incident';
  if (key.indexOf('stray.') === 0) return 'stray';
  return '';
}

function getFallbackReviewControllerStartEventRows_() {
  return [
    {
      'Event Key': 'project.kickoff',
      Lane: 'Project',
      Path: 'Start',
      'Communication Event': 'Project kickoff',
      Active: 'TRUE'
    },
    {
      'Event Key': 'incident.critical.identified',
      Lane: 'Incident / Bug',
      Path: 'Start',
      'Communication Event': 'Critical bug identified',
      Active: 'TRUE'
    },
    {
      'Event Key': 'stray.submitted',
      Lane: 'Stray Story',
      Path: 'Start',
      'Communication Event': 'Stray story submitted',
      Active: 'TRUE'
    },
    {
      'Event Key': 'release.scheduled',
      Lane: 'Production Release',
      Path: 'Start',
      'Communication Event': 'Release scheduled',
      Active: 'TRUE'
    }
  ];
}

function buildReviewControllerItemFromFlow_(flow) {
  const payload = getFlowStatePayload_(flow);
  return {
    'Queue ID': '',
    'Flow ID': flow['Flow ID'] || '',
    'Event Key': flow['Current Event Key'] || payload.event_key || '',
    Lane: flow['Flow Type'] || payload.lane || '',
    Status: flow['Flow Status'] || '',
    Owner: flow.Owner || payload.owner || '',
    Priority: payload.priority || '',
    'Payload JSON': stringifyJson_(Object.assign({}, payload, {
      subject: flow.Subject || payload.subject || flow['Flow ID'],
      owner: flow.Owner || payload.owner || ''
    }))
  };
}

function buildReviewControllerPreviewItem_(form) {
  const parsed = parseReviewControllerSelection_(form.selection);
  let item = {};

  if (parsed.mode === 'queue' && form.queueId) {
    const queueSheet = ensureSheet_(SpreadsheetApp.getActive(), HUB.SHEETS.QUEUE, HUB.HEADERS.QUEUE);
    const row = findQueueRowByQueueId_(queueSheet, form.queueId);
    if (row) item = getRowObject_(queueSheet, row);
  } else if (parsed.mode === 'flow' && (parsed.id || form.flowId)) {
    const flow = findFlowStateByFlowId_(parsed.id || form.flowId);
    if (flow) item = buildReviewControllerItemFromFlow_(flow);
  }

  const eventKey = resolveCanonicalEventKey_(form.eventKey || item['Event Key'] || '', '');
  const payload = normalizePayload_(item);
  payload.event_key = eventKey || payload.event_key || item['Event Key'] || '';
  payload.subject = reviewControllerFormValue_(form, 'subject', payload.subject || '');
  payload.owner = reviewControllerFormValue_(form, 'owner', payload.owner || item.Owner || '');
  payload.what = reviewControllerFormValue_(form, 'what', payload.what || '');
  payload.so_what = reviewControllerFormValue_(form, 'soWhat', payload.so_what || '');
  payload.whats_next = reviewControllerFormValue_(form, 'whatsNext', payload.whats_next || '');
  payload.why = payload.so_what;
  payload.next = payload.whats_next;
  payload.lane = payload.lane || item.Lane || inferLaneFromEventKey_(payload.event_key);

  return Object.assign({}, item, {
    'Queue ID': item['Queue ID'] || '',
    'Flow ID': item['Flow ID'] || form.flowId || '',
    'Event Key': payload.event_key,
    Lane: payload.lane,
    Owner: payload.owner,
    Subject: payload.subject,
    What: payload.what,
    'So What': payload.so_what,
    "What's Next": payload.whats_next,
    what: payload.what,
    so_what: payload.so_what,
    whats_next: payload.whats_next,
    why: payload.so_what,
    next: payload.whats_next,
    'Payload JSON': stringifyJson_(payload)
  });
}

function reviewControllerFormValue_(form, key, fallback) {
  if (form && Object.prototype.hasOwnProperty.call(form, key)) return stringFromForm_(form[key]);
  return fallback || '';
}

function buildReviewControllerPreviewDiagnostics_(item, template, replyText) {
  const payload = normalizePayload_(item);
  const eventKey = item['Event Key'] || payload.event_key || '';
  const expectedTemplateKey = getExpectedReviewControllerTemplateKey_(eventKey);
  const actualTemplateKey = template['Template Key'] || '';
  const registryTemplateKey = template['_Registry Template Key'] || actualTemplateKey;
  const editableValues = {
    subject: payload.subject || item.Subject || '',
    owner: payload.owner || item.Owner || '',
    what: payload.what || item.What || '',
    so_what: payload.so_what || item['So What'] || '',
    whats_next: payload.whats_next || item["What's Next"] || ''
  };
  return {
    eventKey: eventKey,
    templateKey: actualTemplateKey,
    registryTemplateKey: registryTemplateKey,
    expectedTemplateKey: expectedTemplateKey,
    templateMismatch: Boolean(expectedTemplateKey && registryTemplateKey && expectedTemplateKey !== registryTemplateKey),
    replyText: replyText || '',
    values: editableValues
  };
}

function getExpectedReviewControllerTemplateKey_(eventKey) {
  const event = findCachedReviewControllerRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  const registryKey = event && event['Template Key'] || '';
  const defaults = {
    'release.scheduled': 'release-scheduled',
    'release.go_no_go': 'release-go-no-go',
    'release.started': 'release-started',
    'release.completed': 'release-completed',
    'release.delayed': 'release-delayed',
    'release.rollback_evaluating': 'release-rollback-evaluating',
    'release.rollback_decision': 'release-rollback-decision',
    'release.rolled_back': 'release-rolled-back',
    'release.postmortem_needed': 'release-postmortem-needed'
  };
  return defaults[eventKey] || registryKey || '';
}

function buildReviewControllerSelectedDefaults_(item) {
  const payload = normalizePayload_(item);
  const finalMessage = buildReviewControllerFinalMessage_(item);
  return {
    messageTitle: finalMessage.title,
    messageTitleHtml: finalMessage.titleHtml,
    messageBodyHtml: finalMessage.bodyHtml,
    what: payload.what || '',
    soWhat: payload.so_what || '',
    whatsNext: payload.whats_next || ''
  };
}

function enrichReviewControllerDefaultsWithFinalMessage_(defaults, item, flow, eventKey) {
  defaults = Object.assign({}, defaults || {});
  const payload = normalizePayload_(item);
  const subject = flow && flow.Subject ||
    getReviewControllerSubject_(item, payload) ||
    defaults.subject ||
    getReviewControllerEventDisplayName_(eventKey);
  const itemForRender = Object.assign({}, item, {
    'Event Key': eventKey || item['Event Key'] || payload.event_key || '',
    Subject: subject,
    'Payload JSON': stringifyJson_(Object.assign({}, payload, {
      event_key: eventKey || item['Event Key'] || payload.event_key || '',
      subject: subject,
      owner: payload.owner || item.Owner || '',
      what: defaults.what || payload.what || '',
      so_what: defaults.soWhat || payload.so_what || '',
      whats_next: defaults.whatsNext || payload.whats_next || ''
    }))
  });
  const finalMessage = buildReviewControllerFinalMessage_(itemForRender);
  defaults.messageTitle = finalMessage.title;
  defaults.messageTitleHtml = finalMessage.titleHtml;
  defaults.messageBodyHtml = finalMessage.bodyHtml;
  return defaults;
}

function buildReviewControllerActionDefaults_(item, flow, eventKey, action) {
  const flowPayload = getFlowStatePayload_(flow);
  const itemPayload = normalizePayload_(item);
  const subject = flow.Subject ||
    getReviewControllerSubject_(item, Object.assign({}, flowPayload, itemPayload)) ||
    'this communication flow';
  const eventName = getReviewControllerEventDisplayName_(eventKey);
  const currentState = flow['Current Event Key'] ? getReviewControllerEventDisplayName_(flow['Current Event Key']) : 'the current state';

  if (eventKey === 'release.go_no_go') {
    return {
      what: subject + ' is approaching the go / no-go decision point.',
      soWhat: 'Stakeholders should be ready for either release execution or a revised schedule.',
      whatsNext: 'Release owner will confirm readiness, risks, and the go / no-go decision before the release window.'
    };
  }

  if (eventKey === 'release.started') {
    return {
      what: subject + ' has started.',
      soWhat: 'Stakeholders should expect planned production change activity during the release window.',
      whatsNext: 'Release owner will monitor execution and post either completion or an exception update.'
    };
  }

  if (eventKey === 'release.completed') {
    return {
      what: subject + ' has completed.',
      soWhat: 'The planned production change is live and stakeholders can proceed with post-release validation.',
      whatsNext: 'Release owner will monitor for follow-up issues and close the flow if no further action is needed.'
    };
  }

  if (eventKey === 'release.delayed') {
    return {
      what: subject + ' is delayed from the previously communicated timing.',
      soWhat: 'Stakeholders should pause expectations tied to the original release window until the revised plan is confirmed.',
      whatsNext: 'Release owner will confirm the new target timing and the next go / no-go checkpoint.'
    };
  }

  if (eventKey === 'release.rollback_evaluating') {
    return {
      what: subject + ' has a production concern that may require rollback.',
      soWhat: 'Stakeholders should treat production confidence as under review until the release owner confirms the rollback decision.',
      whatsNext: 'Release owner will confirm the rollback decision by [time] and communicate whether the team will continue, delay, or roll back.'
    };
  }

  if (eventKey === 'release.rollback_decision') {
    return {
      what: 'Decision: [continue release / delay release / roll back] for ' + subject + '.',
      soWhat: 'Stakeholders need the confirmed production path before taking action or setting expectations with the field.',
      whatsNext: 'Release owner will execute the decision and post the next release update.'
    };
  }

  if (eventKey === 'release.rolled_back') {
    return {
      what: subject + ' has been rolled back or partially rolled back.',
      soWhat: 'The planned change is not fully live, and stakeholders should operate under the confirmed production state until recovery is communicated.',
      whatsNext: 'Release owner will confirm impact, recovery plan, and whether a postmortem is required.'
    };
  }

  if (eventKey === 'release.postmortem_needed') {
    return {
      what: subject + ' requires a postmortem.',
      soWhat: 'The issue was material enough to require root-cause review and systemic follow-up.',
      whatsNext: 'Owner will schedule the postmortem, document root cause, and track corrective actions.'
    };
  }

  if (eventKey.indexOf('incident.') === 0) {
    return {
      what: eventName + ' for ' + subject + '.',
      soWhat: 'Leadership visibility is needed because this issue may affect customers, operations, support readiness, or stakeholder confidence.',
      whatsNext: 'Owner will confirm impact, recovery path, and next update timing.'
    };
  }

  if (eventKey.indexOf('project.') === 0) {
    return {
      what: subject + ' moved from ' + currentState + ' to ' + eventName + '.',
      soWhat: 'Stakeholders should understand the impact to scope, timing, risk, or decision readiness.',
      whatsNext: 'Owner will confirm the next milestone, decision, or recovery action.'
    };
  }

  return {
    what: eventName + ' for ' + subject + '.',
    soWhat: 'Stakeholders should understand what changed and how it affects expectations.',
    whatsNext: 'Owner will confirm the next action, timing, or decision.'
  };
}

function buildReviewControllerNewStartDefaults_(eventKey) {
  const eventName = getReviewControllerEventDisplayName_(eventKey);
  if (eventKey === 'release.scheduled') {
    return {
      what: 'A production release has been scheduled.',
      soWhat: 'Stakeholders should be aware of the planned production change window and readiness path.',
      whatsNext: 'Release owner will confirm go / no-go readiness before the release window.'
    };
  }

  if (eventKey === 'incident.critical.identified') {
    return {
      what: 'A critical issue has been identified and triage is underway.',
      soWhat: 'Leadership visibility is needed because customer, operational, support, or stakeholder impact may be material.',
      whatsNext: 'Owner will confirm impact, recovery path, and next update timing.'
    };
  }

  if (eventKey === 'project.kickoff') {
    return {
      what: 'The project is entering the managed communication lifecycle.',
      soWhat: 'Stakeholders should have a clear owner, scope intent, and first checkpoint.',
      whatsNext: 'Owner will confirm the next gate, target timing, and key risks.'
    };
  }

  return {
    what: eventName + ' has been created.',
    soWhat: 'Stakeholders should understand why this communication is being opened.',
    whatsNext: 'Owner will confirm the next action, timing, or decision.'
  };
}

function getReviewControllerSubject_(item, payload) {
  return payload.subject ||
    payload.project ||
    payload.release_name ||
    payload.issue_title ||
    payload.release_id ||
    item['Flow ID'] ||
    '';
}

var HUB_REVIEW_CONTROLLER_CACHED_EVENT_ROWS_ = null;
var HUB_REVIEW_CONTROLLER_FALLBACK_EVENT_LABELS_ = {
  'project.kickoff': 'Project kickoff',
  'project.weekly_digest': 'Weekly project digest item',
  'project.gate_approaching': 'Gate approaching',
  'project.gate_passed': 'Gate passed',
  'project.completed': 'Project completed',
  'project.unexpected_status_change': 'Unexpected status change',
  'project.timeline_updated': 'Timeline updated',
  'project.gate_exception': 'Gate missed / failed / delayed',
  'incident.critical.identified': 'Critical bug identified',
  'incident.critical.investigating': 'Investigating',
  'incident.critical.fix_in_progress': 'Fix in progress',
  'incident.critical.fix_in_qa': 'Fix in QA',
  'incident.critical.ready_for_release': 'Fix ready for release',
  'incident.critical.regressed': 'Critical bug state regressed',
  'incident.critical.delayed': 'Critical bug delayed',
  'incident.critical.fix_failed': 'Fix failed',
  'stray.submitted': 'Stray story submitted',
  'stray.weekly_summary': 'Weekly prioritization summary',
  'stray.disposition_changed': 'Disposition changed',
  'stray.exited_intake': 'Stray story exited intake',
  'release.scheduled': 'Release scheduled',
  'release.go_no_go': 'Go / no-go approaching',
  'release.started': 'Release started',
  'release.completed': 'Release completed',
  'release.delayed': 'Release delayed',
  'release.rollback_evaluating': 'Rollback being evaluated',
  'release.rollback_decision': 'Rollback decision made',
  'release.rolled_back': 'Release rolled back',
  'release.postmortem_needed': 'Postmortem required'
};

function getReviewControllerEventDisplayName_(eventKey) {
  const event = findCachedReviewControllerRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  if (event && event['Communication Event']) return event['Communication Event'];

  const labels = HUB_REVIEW_CONTROLLER_FALLBACK_EVENT_LABELS_;
  if (labels[eventKey]) return labels[eventKey];

  const parts = String(eventKey || '').split('.');
  const key = parts.length > 1 ? parts.slice(1).join(' ') : String(eventKey || 'Update');
  return key
    .replace(/_/g, ' ')
    .replace(/\bqa\b/gi, 'QA')
    .replace(/\bapi\b/gi, 'API')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function findCachedReviewControllerRegistryRow_(sheetName, keyField, keyValue) {
  const rows = getReviewControllerCachedRegistryRows_(sheetName);
  return rows.find(row => String(row[keyField]) === String(keyValue)) || null;
}

function getReviewControllerCachedRegistryRows_(sheetName) {
  if (sheetName !== 'Event_Catalog') return getCachedRegistryObjects_(sheetName) || [];
  if (HUB_REVIEW_CONTROLLER_CACHED_EVENT_ROWS_) return HUB_REVIEW_CONTROLLER_CACHED_EVENT_ROWS_;
  HUB_REVIEW_CONTROLLER_CACHED_EVENT_ROWS_ = getCachedRegistryObjects_('Event_Catalog') || [];
  return HUB_REVIEW_CONTROLLER_CACHED_EVENT_ROWS_;
}

function describeReviewControllerEventKeyList_(eventKeys) {
  const keys = String(eventKeys || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value);
  if (!keys.length) return 'No detours configured';
  return keys.map(getReviewControllerEventDisplayName_).join(', ');
}

function stringFromForm_(value) {
  return value == null ? '' : String(value).trim();
}
