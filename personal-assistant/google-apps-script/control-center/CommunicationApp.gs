function doGet(e) {
  const auth = getCommunicationAppAccess_();
  if (!auth.ok) {
    return HtmlService
      .createHtmlOutput(buildCommunicationAppAccessDeniedHtml_(auth))
      .setTitle('Personal Assistant')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  logCommunicationAppEvent_('open_app', {}, {
    page: e && e.parameter && e.parameter.page || ''
  });
  return HtmlService
    .createHtmlOutputFromFile('CommunicationAppPage')
    .setTitle('Personal Assistant Communication Console')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function openCommunicationApp() {
  const url = getCommunicationAppUrl_();
  const body = url ? buildCommunicationAppLauncherHtml_(url) :
    '<div style="font-family:Arial,sans-serif;font-size:13px;padding:12px">' +
    '<p>The Communication App web deployment is not available yet.</p>' +
    '<p>Deploy the Control Center script as a Web App, then set COMMUNICATION_APP_URL if the script cannot resolve it automatically.</p>' +
    '</div>';
  const html = HtmlService
    .createHtmlOutput(body)
    .setWidth(420)
    .setHeight(170);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Communication App');
}

function buildCommunicationAppLauncherHtml_(url) {
  const safeUrl = escapeReviewControllerHtml_(url);
  const jsUrl = JSON.stringify(url);
  return '<!doctype html><html><head><base target="_top"></head>' +
    '<body style="font-family:Arial,sans-serif;font-size:13px;padding:12px">' +
    '<p style="margin-top:0">Opening the Personal Assistant Communication App...</p>' +
    '<div id="fallback" style="display:none">' +
    '<p>Your browser blocked the automatic open.</p>' +
    '<p><a href="' + safeUrl + '" target="_blank">Open Communication App</a></p>' +
    '</div>' +
    '<script>' +
    'var opened=null;' +
    'try{opened=window.open(' + jsUrl + ',"_blank");}catch(error){}' +
    'if(opened){google.script.host.close();}' +
    'else{document.getElementById("fallback").style.display="block";}' +
    '</script>' +
    '</body></html>';
}

function getCommunicationAppContext() {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const context = buildCommunicationAppContext_();
  context.durationMs = new Date().getTime() - startedAt;
  logCommunicationAppEvent_('load_context', {}, {
    inboxCount: context.inbox.items.length,
    pendingSignals: context.dashboard.pending.length,
    durationMs: context.durationMs
  });
  return context;
}

function getCommunicationAppShellContext() {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const context = buildCommunicationAppShellContext_();
  context.durationMs = new Date().getTime() - startedAt;
  logCommunicationAppEvent_('load_shell_context', {}, {
    inboxCount: context.inbox.items.length,
    pendingSignals: context.dashboard.pending.length,
    durationMs: context.durationMs
  });
  return context;
}

function listCommunicationInbox() {
  assertCommunicationAppAccess_();
  return buildCommunicationAppInbox_();
}

function listCommunicationInboxLight() {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const readContext = createControlCenterReadContext_([HUB.SHEETS.QUEUE]);
  const inbox = buildCommunicationAppInbox_(readContext);
  return {
    ok: true,
    inbox: inbox,
    durationMs: new Date().getTime() - startedAt,
    timings: readContext.timings || {}
  };
}

function listActiveCommunicationsLight() {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const readContext = createControlCenterReadContext_([HUB.SHEETS.FLOW_STATE]);
  return {
    ok: true,
    items: buildCommunicationAppActiveCommunications_(readContext),
    durationMs: new Date().getTime() - startedAt,
    timings: readContext.timings || {}
  };
}

function listDashboardSignalsLight() {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const readContext = createControlCenterReadContext_([
    AUTOMATION.SHEETS.CONFIG,
    AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS,
    AUTOMATION.SHEETS.TRIGGER_LOG,
    HUB.SHEETS.ALIGNMENT_RISKS
  ]);
  return {
    ok: true,
    dashboard: buildCommunicationAppDashboard_(readContext, { includeTriggerLog: true }),
    durationMs: new Date().getTime() - startedAt,
    timings: readContext.timings || {}
  };
}

function listHistoryLight(limit, cursor) {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const readContext = createControlCenterReadContext_([HUB.SHEETS.HISTORY]);
  return {
    ok: true,
    items: buildCommunicationAppHistory_('', limit || 20, readContext),
    cursor: cursor || '',
    durationMs: new Date().getTime() - startedAt,
    timings: readContext.timings || {}
  };
}

function listNewCommunicationOptionsLight() {
  assertCommunicationAppAccess_();
  return {
    ok: true,
    items: buildReviewControllerNewCommunicationOptions_(),
    durationMs: 0
  };
}

function getCommunicationDetail(selection) {
  const context = getCommunicationDetailFast(selection);
  if (!context || !context.ok) return context;
  const flowId = context.queue && context.queue.flowId || context.flow && context.flow.flowId || '';
  context.history = flowId ? buildCommunicationAppHistory_(flowId, 30) : [];
  context.evidence = buildCommunicationAppEvidence_(context);
  return context;
}

function getCommunicationDetailFast(selection) {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const context = buildCommunicationDetailFast_(selection || '');
  if (!context || !context.ok) return context;
  const flowId = context.queue && context.queue.flowId || context.flow && context.flow.flowId || '';
  context.history = [];
  context.evidence = {
    summary: 'Loading source evidence...',
    items: []
  };
  context.readiness = buildCommunicationAppReadiness_(context);
  context.ai = buildCommunicationAppAiState_(context);
  context.durationMs = new Date().getTime() - startedAt;
  logCommunicationAppEvent_('load_detail', {
    selection: selection || '',
    queueId: context.queue && context.queue.queueId || '',
    flowId: flowId,
    eventKey: context.queue && context.queue.eventKey || ''
  }, {});
  return context;
}

function getCommunicationDetailEvidence(selection) {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  const context = buildCommunicationDetailFast_(selection || '');
  if (!context || !context.ok) return {
    ok: false,
    message: context && context.message || 'Unable to load detail evidence.'
  };
  const evidence = buildCommunicationAppEvidence_(context);
  evidence.durationMs = new Date().getTime() - startedAt;
  return evidence;
}

function getCommunicationDetailHistory(flowId, limit) {
  assertCommunicationAppAccess_();
  const startedAt = new Date().getTime();
  return {
    ok: true,
    items: flowId ? buildCommunicationAppHistory_(flowId, limit || 10) : [],
    durationMs: new Date().getTime() - startedAt
  };
}

function generateInitialCommunicationAiDraft(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('ai_initial_draft', form || {}, {});
  return generateCommunicationDraftWithGemini_(form || {}, {
    mode: 'initial',
    persist: true
  });
}

function redraftCommunicationWithAi(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('ai_redraft', form || {}, {});
  return generateCommunicationDraftWithGemini_(form || {}, {
    mode: 'redraft',
    persist: false
  });
}

function saveCommunicationDraft(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('save_draft', form || {}, {});
  return withHubReviewSyncSuppressed_(function() {
    return saveReviewControllerDraft(form || {});
  });
}

function sendCommunicationTest(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('send_test', form || {}, {});
  return withHubReviewSyncSuppressed_(function() {
    return sendReviewControllerTest(form || {});
  });
}

function approveCommunication(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('approve_live', form || {}, {});
  return withHubReviewSyncSuppressed_(function() {
    return approveReviewControllerSelection(form || {});
  });
}

function discardCommunication(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('discard', form || {}, {});
  return withHubReviewSyncSuppressed_(function() {
    return discardReviewControllerDraft(form || {});
  });
}

function createCommunication(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('create_communication', form || {}, {});
  return withHubReviewSyncSuppressed_(function() {
    return queueReviewControllerDraft(form || {});
  });
}

function syncDashboardFromWebApp() {
  assertCommunicationAppAccess_();
  const result = withHubReviewSyncSuppressed_(function() {
    return syncDashboardFromCommunicationConsole({
      source: 'Communication Web App'
    });
  });
  logCommunicationAppEvent_('manual_dashboard_sync', {}, {
    ok: result.ok,
    message: result.message || '',
    syncMode: result.result && result.result.syncMode || '',
    changedRows: result.result && result.result.changedRows,
    draftsCreated: result.result && result.result.hubDraftsCreated,
    pendingEvaluations: result.result && result.result.pendingEvaluations,
    durationMs: result.result && result.result.durationMs,
    timings: result.result && result.result.timings || {}
  });
  return result;
}

function getCommunicationHistory(flowId) {
  assertCommunicationAppAccess_();
  return buildCommunicationAppHistory_(flowId || '', 30);
}

function getControlCenterSpreadsheet_() {
  const configuredId = String(getScriptProperty_('CONTROL_CENTER_SPREADSHEET_ID') || '').trim();
  if (configuredId) return SpreadsheetApp.openById(configuredId);

  const active = SpreadsheetApp.getActive();
  if (active) return active;

  throw new Error('Control Center spreadsheet is unavailable. Set CONTROL_CENTER_SPREADSHEET_ID in Script Properties.');
}

function buildCommunicationAppContext_() {
  const access = getCommunicationAppAccess_();
  const readContext = createControlCenterReadContext_([
    HUB.SHEETS.QUEUE,
    HUB.SHEETS.FLOW_STATE,
    HUB.SHEETS.HISTORY,
    AUTOMATION.SHEETS.CONFIG,
    AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS,
    AUTOMATION.SHEETS.TRIGGER_LOG,
    HUB.SHEETS.ALIGNMENT_RISKS
  ]);
  const inbox = buildCommunicationAppInbox_(readContext);
  const active = buildCommunicationAppActiveCommunications_(readContext);
  const dashboard = buildCommunicationAppDashboard_(readContext, { includeTriggerLog: true });
  const actionInbox = buildCommunicationAppActionInbox_(inbox.items, dashboard);
  const history = buildCommunicationAppHistory_('', 20, readContext);
  const appUrl = getCommunicationAppUrl_();
  return {
    ok: true,
    generatedAt: nowIso_(),
    user: access.email || '',
    appUrl: appUrl,
    spreadsheetId: readContext.ss.getId(),
    inbox: inbox,
    actionInbox: actionInbox,
    activeCommunications: active,
    activeCommunicationsLoaded: true,
    dashboard: dashboard,
    dashboardSignalsLoaded: true,
    history: history,
    historyLoaded: true,
    newCommunicationOptions: buildReviewControllerNewCommunicationOptions_(),
    newCommunicationOptionsLoaded: true,
    timings: readContext.timings || {},
    stats: {
      inbox: inbox.items.length,
      errors: inbox.items.filter(item => item.status === HUB.STATUS.ERROR).length,
      scheduled: inbox.items.filter(item => item.status === HUB.STATUS.SCHEDULED).length,
      pendingSignals: dashboard.pending.length,
      activeCommunications: active.length,
      needsReview: actionInbox.summary.needsReview,
      readyLive: actionInbox.summary.readyLive,
      needsContext: actionInbox.summary.needsContext,
      failed: actionInbox.summary.failed,
      recentTests: actionInbox.summary.recentTests
    }
  };
}

function buildCommunicationAppShellContext_() {
  const access = getCommunicationAppAccess_();
  const readContext = createControlCenterReadContext_([
    HUB.SHEETS.QUEUE,
    AUTOMATION.SHEETS.CONFIG,
    AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS,
    HUB.SHEETS.ALIGNMENT_RISKS
  ]);
  const inbox = buildCommunicationAppInbox_(readContext);
  const dashboard = buildCommunicationAppDashboard_(readContext, { includeTriggerLog: false });
  const actionInbox = buildCommunicationAppActionInbox_(inbox.items, dashboard);
  const appUrl = getCommunicationAppUrl_();
  return {
    ok: true,
    generatedAt: nowIso_(),
    user: access.email || '',
    appUrl: appUrl,
    spreadsheetId: readContext.ss.getId(),
    inbox: inbox,
    actionInbox: actionInbox,
    activeCommunications: [],
    activeCommunicationsLoaded: false,
    dashboard: dashboard,
    dashboardSignalsLoaded: false,
    history: [],
    historyLoaded: false,
    newCommunicationOptions: [],
    newCommunicationOptionsLoaded: false,
    timings: readContext.timings || {},
    stats: {
      inbox: inbox.items.length,
      errors: inbox.items.filter(item => item.status === HUB.STATUS.ERROR).length,
      scheduled: inbox.items.filter(item => item.status === HUB.STATUS.SCHEDULED).length,
      pendingSignals: dashboard.pending.length,
      activeCommunications: 0,
      needsReview: actionInbox.summary.needsReview,
      readyLive: actionInbox.summary.readyLive,
      needsContext: actionInbox.summary.needsContext,
      failed: actionInbox.summary.failed,
      recentTests: actionInbox.summary.recentTests
    }
  };
}

function buildCommunicationDetailFast_(selection) {
  try {
    const selectedValue = String(selection || '').trim() || 'new:project';
    const parsed = parseReviewControllerSelection_(selectedValue);
    if (parsed.mode === 'new') return buildReviewControllerNewContext_([], selectedValue);
    const readContext = createControlCenterReadContext_([
      HUB.SHEETS.QUEUE,
      HUB.SHEETS.FLOW_STATE
    ]);
    if (parsed.mode === 'flow') return buildCommunicationFlowDetailFast_(parsed.id, selectedValue, readContext);
    return buildCommunicationQueueDetailFast_(parsed.id, selectedValue, readContext);
  } catch (error) {
    return {
      ok: false,
      message: error.message || String(error)
    };
  }
}

function buildCommunicationQueueDetailFast_(queueId, selectedValue, readContext) {
  const item = getSheetObjectsCached_(readContext, HUB.SHEETS.QUEUE)
    .find(row => String(row['Queue ID'] || '') === String(queueId));
  if (!item) throw new Error('Queue item is no longer active: ' + queueId);

  const payload = normalizePayload_(item);
  const finalMessage = buildReviewControllerFinalMessage_(item);
  const flow = item['Flow ID'] ?
    indexRowsBy_(getSheetObjectsCached_(readContext, HUB.SHEETS.FLOW_STATE), 'Flow ID')[String(item['Flow ID'])] || null :
    null;

  return {
    ok: true,
    mode: 'queue',
    communications: [],
    selectedCommunication: selectedValue,
    selection: {
      sourceSheet: HUB.SHEETS.QUEUE,
      row: 0,
      queueRow: 0
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
      payloadJson: item['Payload JSON'] || '',
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

function buildCommunicationFlowDetailFast_(flowId, selectedValue, readContext) {
  const flow = indexRowsBy_(getSheetObjectsCached_(readContext, HUB.SHEETS.FLOW_STATE), 'Flow ID')[String(flowId)] || null;
  if (!flow) throw new Error('Flow not found in Flow_State: ' + flowId);

  const item = buildReviewControllerItemFromFlow_(flow);
  const payload = normalizePayload_(item);
  const finalMessage = buildReviewControllerFinalMessage_(item);
  return {
    ok: true,
    mode: 'flow',
    communications: [],
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
      payloadJson: item['Payload JSON'] || '',
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

function buildCommunicationAppInbox_(readContext) {
  const rows = getSheetObjectsCached_(readContext, HUB.SHEETS.QUEUE);
  const activeStatuses = [HUB.STATUS.DRAFT, HUB.STATUS.SCHEDULED, HUB.STATUS.ERROR];
  const items = rows
    .filter(row => activeStatuses.indexOf(String(row.Status || '').trim()) >= 0)
    .map(row => buildCommunicationAppQueueCard_(row))
    .sort(sortCommunicationAppCards_);
  return {
    items: items,
    updatedAt: nowIso_()
  };
}

function buildCommunicationAppQueueCard_(row) {
  const payload = normalizePayload_(row);
  const eventKey = row['Event Key'] || payload.event_key || '';
  const subject = getReviewControllerSubject_(row, payload) || 'Untitled communication';
  const testUrl = row['Test Slack Message URL'] || '';
  const card = {
    kind: 'draft',
    selection: 'queue:' + row['Queue ID'],
    queueId: row['Queue ID'] || '',
    flowId: row['Flow ID'] || '',
    eventKey: eventKey,
    eventName: getReviewControllerEventDisplayName_(eventKey),
    subject: subject,
    owner: row.Owner || payload.owner || '',
    lane: row.Lane || payload.lane || inferLaneFromEventKey_(eventKey),
    status: row.Status || '',
    source: friendlyCommunicationAppSource_(row.Source || ''),
    priority: row.Priority || payload.priority || '',
    scheduledFor: row['Scheduled For'] || payload.scheduled_for || '',
    updatedAt: row['Updated At'] || '',
    createdAt: row['Created At'] || '',
    error: row.Error || '',
    testSlackUrl: testUrl,
    testSentAt: row['Test Sent At'] || '',
    testSlackChannel: row['Test Slack Channel'] || '',
    testSlackThreadTs: row['Test Slack Thread TS'] || '',
    testSlackMessageTs: row['Test Slack Message TS'] || '',
    hasTitle: Boolean(String(payload.message_title || payload.message_title_mrkdwn || payload.message_title_html || subject || '').trim()),
    hasBody: Boolean(String(payload.message_body_mrkdwn || '').trim() || stripHtml_(payload.message_body_html || '').trim() || String(payload.what || payload.so_what || payload.whats_next || '').trim()),
    hasTest: Boolean(testUrl),
    hasLive: Boolean(row['Slack Message URL'])
  };
  return Object.assign(card, classifyCommunicationAppDraft_(card, row, payload));
}

function classifyCommunicationAppDraft_(card, row, payload) {
  if (card.status === HUB.STATUS.ERROR || card.error) {
    return {
      decisionState: 'failed',
      decisionLabel: 'Failed',
      nextAction: 'Open and resolve',
      why: card.error || 'The last processing attempt failed and needs PM attention.'
    };
  }

  if (!card.hasTitle || !card.hasBody) {
    return {
      decisionState: 'needs_context',
      decisionLabel: 'Needs context',
      nextAction: 'Complete message',
      why: 'The draft needs a usable title and body before it can be tested or sent.'
    };
  }

  if (card.hasTest) {
    return {
      decisionState: 'ready_live',
      decisionLabel: 'Ready for live',
      nextAction: 'Approve live send',
      why: 'A sandbox test exists; review the final content and approve the live route.'
    };
  }

  if (card.status === HUB.STATUS.SCHEDULED) {
    return {
      decisionState: 'scheduled_soon',
      decisionLabel: 'Scheduled',
      nextAction: 'Review scheduled draft',
      why: 'This was scheduled by the flow or dashboard and is waiting for PM review.'
    };
  }

  return {
    decisionState: 'needs_review',
    decisionLabel: 'Needs review',
    nextAction: 'Review and send test',
    why: buildCommunicationAppDraftReason_(card, payload)
  };
}

function buildCommunicationAppDraftReason_(card, payload) {
  if (/dashboard/i.test(card.source || '')) {
    return 'A dashboard signal created this draft for PM review before stakeholder communication.';
  }
  if (/flow/i.test(card.source || '')) {
    return 'The active communication flow scheduled this next step.';
  }
  if (payload && payload.release_type === 'Special Release') {
    return 'A project dashboard row scheduled a special release that needs release-style communication.';
  }
  return 'This draft is ready for PM review, sandbox testing, and live approval.';
}

function buildCommunicationAppActionInbox_(items, dashboard) {
  const groups = [
    {
      id: 'needs_review',
      label: 'Needs Review',
      description: 'Drafts that need PM review before a test or live send.',
      items: []
    },
    {
      id: 'ready_live',
      label: 'Ready For Live',
      description: 'Drafts with a test send already available.',
      items: []
    },
    {
      id: 'needs_context',
      label: 'Needs Context',
      description: 'Drafts missing message content or source context.',
      items: []
    },
    {
      id: 'failed',
      label: 'Failed',
      description: 'Drafts or sync results with errors that need attention.',
      items: []
    },
    {
      id: 'scheduled_soon',
      label: 'Scheduled Soon',
      description: 'Flow-scheduled drafts waiting for PM review.',
      items: []
    },
    {
      id: 'stabilizing',
      label: 'Stabilizing',
      description: 'Dashboard signals waiting for the stable-poll guard.',
      items: []
    },
    {
      id: 'recent_tests',
      label: 'Recent Tests',
      description: 'Drafts recently sent to the sandbox Slack route.',
      items: []
    }
  ];
  const byId = groups.reduce((memo, group) => {
    memo[group.id] = group;
    return memo;
  }, {});

  (items || []).forEach(item => {
    const state = byId[item.decisionState] ? item.decisionState : 'needs_review';
    byId[state].items.push(item);
    if (item.hasTest) byId.recent_tests.items.push(item);
  });

  ((dashboard && dashboard.pending) || []).forEach(item => {
    const pendingCard = Object.assign({}, item, {
      kind: 'signal',
      selection: '',
      subject: item.subject || item.flowId || item.sourceItemId || 'Dashboard signal',
      owner: '',
      source: 'Dashboard sync',
      decisionState: item.status === 'Error' ? 'failed' : 'stabilizing',
      decisionLabel: item.status || 'Pending Evaluation',
      nextAction: item.status === 'Needs Reason' ? 'Add source context' : 'Wait for stable polls',
      why: item.status === 'Needs Reason' ?
        'The signal looks communication-worthy but needs a reason before a draft can be created.' :
        'The source row changed and the automation is waiting for the configured stable-poll threshold.'
    });
    byId[pendingCard.decisionState].items.push(pendingCard);
  });

  ((dashboard && dashboard.alignmentRisks) || []).forEach(item => {
    const riskCard = Object.assign({}, item, {
      kind: 'signal',
      selection: '',
      subject: item.subject || item.flowId || item.sourceItemId || 'Alignment risk',
      owner: '',
      source: 'Trust layer',
      decisionState: item.status === 'Error' ? 'failed' : 'needs_context',
      decisionLabel: item.riskType || 'Alignment Risk',
      nextAction: 'Review source evidence',
      why: item.summary || 'Source evidence appears to differ from official project state.'
    });
    byId[riskCard.decisionState].items.push(riskCard);
  });

  const visibleGroups = groups.filter(group => group.items.length);
  return {
    groups: visibleGroups,
    summary: {
      needsReview: byId.needs_review.items.length,
      readyLive: byId.ready_live.items.length,
      needsContext: byId.needs_context.items.length,
      failed: byId.failed.items.length,
      scheduledSoon: byId.scheduled_soon.items.length,
      stabilizing: byId.stabilizing.items.length,
      recentTests: byId.recent_tests.items.length,
      total: visibleGroups.reduce((sum, group) => sum + group.items.length, 0)
    },
    updatedAt: nowIso_()
  };
}

function buildCommunicationAppActiveCommunications_(readContext) {
  const rows = getSheetObjectsCached_(readContext, HUB.SHEETS.FLOW_STATE);
  return rows
    .filter(row => row['Flow ID'])
    .map(row => ({
      kind: 'flow',
      selection: 'flow:' + row['Flow ID'],
      flowId: row['Flow ID'] || '',
      subject: row.Subject || row['Flow ID'] || '',
      owner: row.Owner || '',
      lane: row['Flow Type'] || '',
      status: row['Flow Status'] || '',
      currentState: getReviewControllerEventDisplayName_(row['Current Event Key']),
      expectedNext: row['Next Happy Event Key'] ? getReviewControllerEventDisplayName_(row['Next Happy Event Key']) : 'No expected next step',
      detours: describeReviewControllerEventKeyList_(row['Allowed Detour Event Keys']),
      liveSlackUrl: row['Anchor Message URL'] || '',
      testSlackUrl: row['Test Anchor Message URL'] || '',
      lastConfirmedAt: row['Last Confirmed At'] || '',
      updatedAt: row['Updated At'] || ''
    }))
    .sort((a, b) => compareCommunicationAppDates_(b.updatedAt || b.lastConfirmedAt, a.updatedAt || a.lastConfirmedAt));
}

function buildCommunicationAppDashboard_(readContext, options) {
  options = options || {};
  const ss = readContext && readContext.ss || getControlCenterSpreadsheet_();
  const config = readCommunicationAppConfig_(ss, readContext);
  const observations = getSheetObjectsCached_(readContext, AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS)
    .filter(row => row['Source Item ID']);
  const includeTriggerLog = options.includeTriggerLog !== false;
  const triggerLog = includeTriggerLog ?
    getSheetObjectsCached_(readContext, AUTOMATION.SHEETS.TRIGGER_LOG)
      .filter(row => row['Trigger Log ID'])
      .slice(0, 20) :
    [];
  const pending = observations
    .filter(row => row['Pending State Hash'] || ['Pending Evaluation', 'Needs Reason', 'Error'].indexOf(String(row['Processing Status'] || '').trim()) >= 0)
    .map(row => ({
      sourceItemId: row['Source Item ID'] || '',
      flowId: row['Flow ID'] || '',
      recordType: row['Record Type'] || '',
      subject: row.Subject || row['Flow ID'] || '',
      status: row['Processing Status'] || '',
      error: row['Processing Error'] || '',
      eventKey: row['Pending Event Key'] || '',
      eventName: row['Pending Event Key'] ? getReviewControllerEventDisplayName_(row['Pending Event Key']) : '',
      triggerCandidate: row['Pending Trigger Candidate'] || '',
      stablePolls: row['Pending Stable Polls'] || '',
      pendingSince: row['Pending Since'] || '',
      lastSeenAt: row['Pending Last Seen At'] || row['Last Observed At'] || ''
    }));
  const alignmentRisks = getSheetObjectsCached_(readContext, HUB.SHEETS.ALIGNMENT_RISKS)
    .filter(row => row['Risk ID'] && String(row.Status || '') === TRUST_LAYER.RISK_STATUS.OPEN)
    .slice(0, 20)
    .map(row => ({
      riskId: row['Risk ID'] || '',
      sourceItemId: row['Entity ID'] || '',
      flowId: row['Flow ID'] || '',
      recordType: row['Entity Type'] || '',
      subject: row['Entity ID'] || row['Flow ID'] || row['Risk Type'] || 'Alignment risk',
      status: row.Status || '',
      error: row.Error || '',
      eventKey: '',
      eventName: row['Risk Type'] || '',
      triggerCandidate: row['Risk Type'] || '',
      stablePolls: '',
      pendingSince: row['Created At'] || '',
      lastSeenAt: row['Updated At'] || row['Created At'] || '',
      riskType: row['Risk Type'] || '',
      severity: row.Severity || '',
      summary: row['Evidence Summary'] || ''
    }));
  return {
    config: {
      createHubDrafts: config.CREATE_HUB_DRAFTS || '',
      lastSyncMode: config.LAST_SYNC_MODE || '',
      pollCount: config.POLL_COUNT || '',
      lastFastCheckAt: config.LAST_FAST_CHECK_AT || '',
      lastChangeIndexAt: config.LAST_CHANGE_INDEX_AT || '',
      stablePolls: config.DASHBOARD_STABLE_POLLS || ''
    },
    pending: pending,
    alignmentRisks: alignmentRisks,
    recentTriggers: triggerLog.map(row => ({
      id: row['Trigger Log ID'] || '',
      createdAt: row['Created At'] || '',
      subject: row['New State Summary'] || row['Old State Summary'] || row['Flow ID'] || '',
      flowId: row['Flow ID'] || '',
      sourceItemId: row['Source Row Key'] || '',
      candidate: row['Trigger Candidate'] || '',
      eventKey: row['Event Key'] || '',
      eventName: row['Event Key'] ? getReviewControllerEventDisplayName_(row['Event Key']) : '',
      status: row['Processing Status'] || '',
      queueId: row['Hub Queue ID'] || '',
      error: row['Processing Error'] || ''
    }))
  };
}

function buildCommunicationAppReadiness_(context) {
  const queue = context.queue || {};
  const flow = context.flow || {};
  const routes = resolveCommunicationAppReadinessRoutes_(context);
  const titleReady = Boolean(stripHtml_(queue.messageTitleHtml || queue.messageTitle || '').trim());
  const bodyReady = Boolean(stripHtml_(queue.messageBodyHtml || '').trim());
  const sourceAvailable = Boolean(queue.source || queue.flowId || flow.exists || context.evidence && context.evidence.summary);
  const items = [
    buildCommunicationAppReadinessItem_('Title ready', titleReady, titleReady ? 'Title is present.' : 'Add a concise title.'),
    buildCommunicationAppReadinessItem_('Body ready', bodyReady, bodyReady ? 'Body is present.' : 'Add the stakeholder message body.'),
    buildCommunicationAppReadinessItem_('Test channel resolved', Boolean(routes.testChannel), routes.testMessage),
    buildCommunicationAppReadinessItem_('Live channel resolved', Boolean(routes.liveChannel), routes.liveMessage),
    buildCommunicationAppReadinessItem_('Test sent', Boolean(queue.testSlackUrl || flow.testAnchorUrl), queue.testSlackUrl || flow.testAnchorUrl ? 'Sandbox Slack message is available.' : 'Send a sandbox test before live approval.', false),
    buildCommunicationAppReadinessItem_('Live approval', Boolean(queue.slackUrl || flow.anchorUrl), queue.slackUrl || flow.anchorUrl ? 'Live Slack anchor exists.' : 'Not approved live yet.', false),
    buildCommunicationAppReadinessItem_('Source evidence', sourceAvailable, sourceAvailable ? 'Source and flow context are available.' : 'No source evidence was found.'),
    buildCommunicationAppReadinessItem_('No blocking error', !queue.error, queue.error || 'No current Queue error.')
  ];
  const blocking = items.filter(item => item.blocking && !item.ok);
  return {
    ok: blocking.length === 0,
    status: blocking.length ? 'Needs attention' : 'Ready',
    items: items,
    routes: routes,
    blockingCount: blocking.length
  };
}

function buildCommunicationAppReadinessItem_(label, ok, detail, blocking) {
  return {
    label: label,
    ok: Boolean(ok),
    state: ok ? 'ok' : 'warn',
    blocking: blocking !== false,
    detail: detail || ''
  };
}

function resolveCommunicationAppReadinessRoutes_(context) {
  const queue = context.queue || {};
  const flow = context.flow || {};
  const item = {
    'Queue ID': queue.queueId || '',
    'Flow ID': queue.flowId || flow.flowId || '',
    'Event Key': queue.eventKey || '',
    Lane: queue.lane || inferLaneFromEventKey_(queue.eventKey || ''),
    Owner: queue.owner || flow.owner || '',
    'Payload JSON': stringifyJson_({
      event_key: queue.eventKey || '',
      subject: queue.subject || flow.subject || '',
      owner: queue.owner || flow.owner || ''
    })
  };
  try {
    const template = findReviewControllerTemplateForPreview_(item);
    const channelType = template['Channel Type'] || inferLaneFromEventKey_(queue.eventKey || '');
    const testChannel = queue.testSlackChannel || flow.testSlackChannel || resolveTestChannel_(channelType);
    const liveChannel = flow.slackChannel || resolveDefaultChannel_(channelType);
    return {
      channelType: channelType,
      testChannel: testChannel,
      liveChannel: liveChannel,
      testMessage: testChannel ? 'Sandbox route is configured.' : 'No sandbox route found.',
      liveMessage: liveChannel ? 'Live route is configured.' : 'No live route found.'
    };
  } catch (error) {
    return {
      channelType: '',
      testChannel: queue.testSlackChannel || flow.testSlackChannel || '',
      liveChannel: flow.slackChannel || '',
      testMessage: queue.testSlackChannel || flow.testSlackChannel ? 'Sandbox route was recorded on this communication.' : error.message || String(error),
      liveMessage: flow.slackChannel ? 'Live route was recorded on the flow.' : error.message || String(error)
    };
  }
}

function buildCommunicationAppEvidence_(context) {
  const queue = context.queue || {};
  const flow = context.flow || {};
  const trigger = findCommunicationAppTriggerEvidence_(queue);
  const evidence = {
    summary: '',
    items: []
  };

  if (trigger) {
    evidence.summary = trigger.candidate || trigger.eventName || 'Dashboard-created draft';
    evidence.items.push({
      label: 'Dashboard signal',
      value: trigger.candidate || trigger.eventName || 'Dashboard signal'
    });
    evidence.items.push({
      label: 'Source item',
      value: trigger.sourceItemId || trigger.flowId || ''
    });
    evidence.items.push({
      label: 'Trigger status',
      value: trigger.status || ''
    });
    if (trigger.createdAt) evidence.items.push({
      label: 'Detected',
      value: trigger.createdAt
    });
    if (trigger.error) evidence.items.push({
      label: 'Error',
      value: trigger.error
    });
    return evidence;
  }

  evidence.summary = queue.source || (flow.exists ? 'Existing communication flow' : 'Communication Console draft');
  evidence.items.push({
    label: 'Source',
    value: queue.source || 'Communication Console'
  });
  if (queue.flowId || flow.flowId) evidence.items.push({
    label: 'Flow ID',
    value: queue.flowId || flow.flowId
  });
  if (queue.eventName || queue.eventKey) evidence.items.push({
    label: 'Event',
    value: queue.eventName || queue.eventKey
  });
  if (queue.createdAt) evidence.items.push({
    label: 'Created',
    value: queue.createdAt
  });
  return evidence;
}

function findCommunicationAppTriggerEvidence_(queue) {
  if (!queue || (!queue.queueId && !queue.flowId)) return null;
  const rows = readCommunicationAppObjects_(getControlCenterSpreadsheet_(), AUTOMATION.SHEETS.TRIGGER_LOG);
  const match = rows.find(row =>
    (queue.queueId && row['Hub Queue ID'] === queue.queueId) ||
    (queue.flowId && row['Flow ID'] === queue.flowId && row['Event Key'] === queue.eventKey)
  );
  if (!match) return null;
  return {
    id: match['Trigger Log ID'] || '',
    createdAt: match['Created At'] || '',
    flowId: match['Flow ID'] || '',
    sourceItemId: match['Source Row Key'] || '',
    candidate: match['Trigger Candidate'] || '',
    eventKey: match['Event Key'] || '',
    eventName: match['Event Key'] ? getReviewControllerEventDisplayName_(match['Event Key']) : '',
    status: match['Processing Status'] || '',
    error: match['Processing Error'] || ''
  };
}

function buildCommunicationAppAiState_(context) {
  const queue = context.queue || {};
  const payload = queue.payloadJson ?
    parseJsonObject_(queue.payloadJson) :
    (queue.queueId ? normalizePayload_(findCommunicationAppQueueRow_(queue.queueId) || {}) : {});
  const hasSavedFinal = Boolean(String(payload.message_title || payload.message_title_mrkdwn || payload.message_body_mrkdwn || payload.message_title_html || payload.message_body_html || '').trim());
  return {
    enabled: Boolean(String(getScriptProperty_('GEMINI_API_KEY') || '').trim()),
    model: getGeminiCommunicationModel_(),
    status: payload.message_ai_status || '',
    needsInitialDraft: !hasSavedFinal && Boolean(queue.eventKey) && payload.message_ai_status !== 'AI_Complete',
    generatedAt: payload.message_ai_generated_at || '',
    redraftedAt: payload.message_ai_redrafted_at || '',
    modelUsed: payload.message_ai_model || ''
  };
}

function findCommunicationAppQueueRow_(queueId) {
  const sheet = getControlCenterSpreadsheet_().getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet || !queueId) return null;
  const row = findQueueRowByQueueId_(sheet, queueId);
  return row ? getRowObject_(sheet, row) : null;
}

function buildCommunicationAppHistory_(flowId, limit, readContext) {
  const rows = getSheetObjectsCached_(readContext, HUB.SHEETS.HISTORY);
  return rows
    .filter(row => !flowId || String(row['Flow ID'] || '') === String(flowId))
    .slice(0, limit || 20)
    .map(row => ({
      historyId: row['History ID'] || '',
      queueId: row['Queue ID'] || '',
      flowId: row['Flow ID'] || '',
      eventKey: row['Event Key'] || '',
      eventName: getReviewControllerEventDisplayName_(row['Event Key']),
      status: row['Final Status'] || row.Status || '',
      subject: row.Subject || row['Flow ID'] || '',
      owner: row.Owner || '',
      completedAt: row['Completed At'] || '',
      liveSlackUrl: row['Slack Message URL'] || '',
      testSlackUrl: row['Test Slack Message URL'] || '',
      error: row.Error || ''
    }));
}

function readCommunicationAppObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet ? getObjects_(sheet) : [];
}

function createControlCenterReadContext_(sheetNames) {
  const context = {
    ss: getControlCenterSpreadsheet_(),
    rowsBySheet: {},
    timings: {}
  };
  (sheetNames || []).forEach(name => getSheetObjectsCached_(context, name));
  return context;
}

function getSheetObjectsCached_(context, sheetName) {
  if (!sheetName) return [];
  if (!context) {
    return readCommunicationAppObjects_(getControlCenterSpreadsheet_(), sheetName);
  }
  if (Object.prototype.hasOwnProperty.call(context.rowsBySheet, sheetName)) {
    return context.rowsBySheet[sheetName];
  }

  const startedAt = new Date().getTime();
  const sheet = context.ss.getSheetByName(sheetName);
  const rows = sheet ? getObjects_(sheet) : [];
  context.rowsBySheet[sheetName] = rows;
  context.timings['read:' + sheetName] = new Date().getTime() - startedAt;
  return rows;
}

function indexRowsBy_(rows, key) {
  return (rows || []).reduce((index, row) => {
    const value = typeof key === 'function' ? key(row) : row[key];
    if (value != null && value !== '') index[String(value)] = row;
    return index;
  }, {});
}

function readCommunicationAppConfig_(ss, readContext) {
  const rows = getSheetObjectsCached_(readContext, AUTOMATION.SHEETS.CONFIG);
  return rows.reduce((obj, row) => {
    if (row.Key) obj[row.Key] = row.Value;
    return obj;
  }, {});
}

function sortCommunicationAppCards_(a, b) {
  const rank = {
    Error: 0,
    Draft: 1,
    Scheduled: 2
  };
  const rankA = rank[a.status] == null ? 9 : rank[a.status];
  const rankB = rank[b.status] == null ? 9 : rank[b.status];
  if (rankA !== rankB) return rankA - rankB;
  return compareCommunicationAppDates_(b.updatedAt || b.createdAt, a.updatedAt || a.createdAt);
}

function compareCommunicationAppDates_(a, b) {
  const timeA = a ? new Date(a).getTime() : 0;
  const timeB = b ? new Date(b).getTime() : 0;
  return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
}

function friendlyCommunicationAppSource_(source) {
  const value = String(source || '').trim();
  if (!value) return 'Communication Console';
  if (/dashboard/i.test(value)) return 'Dashboard sync';
  if (/console/i.test(value)) return 'Communication Console';
  if (/flow/i.test(value)) return 'Flow step';
  return value;
}

function getCommunicationAppUrl_() {
  const configured = String(getScriptProperty_('COMMUNICATION_APP_URL') || '').trim();
  if (configured) return configured;
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (error) {
    return '';
  }
}

function getCommunicationAppAccess_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const rawAllowed = String(getScriptProperty_('WEB_APP_ALLOWED_EMAILS') || '').trim();
  if (!rawAllowed) {
    return {
      ok: true,
      email: email
    };
  }

  const allowed = rawAllowed
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(value => value);
  return {
    ok: Boolean(email && allowed.indexOf(email) >= 0),
    email: email,
    allowlistConfigured: true
  };
}

function assertCommunicationAppAccess_() {
  const access = getCommunicationAppAccess_();
  if (!access.ok) {
    logCommunicationAppEvent_('access_denied', {}, {
      email: access.email || ''
    });
    throw new Error('You are not authorized to use the Personal Assistant Communication App.');
  }
  return access;
}

function buildCommunicationAppAccessDeniedHtml_(auth) {
  const email = auth && auth.email ? auth.email : 'Unknown user';
  return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:64px auto;color:#202124">' +
    '<h1>Personal Assistant</h1>' +
    '<p>This Google account is not authorized to use the Communication App.</p>' +
    '<p><strong>User:</strong> ' + escapeReviewControllerHtml_(email) + '</p>' +
    '<p>Ask the Control Center owner to add your email to WEB_APP_ALLOWED_EMAILS, or remove that property for unrestricted domain-level access.</p>' +
    '</div>';
}

function logCommunicationAppEvent_(eventType, form, details) {
  const safeForm = form || {};
  const access = getCommunicationAppAccess_();
  logHub_('INFO', 'CommunicationApp', safeForm.queueId || '', 'Communication App event: ' + eventType, {
    eventType: eventType,
    user: access.email || '',
    selection: safeForm.selection || '',
    flowAction: safeForm.flowAction || '',
    eventKey: safeForm.eventKey || '',
    flowId: safeForm.flowId || '',
    detail: details || {}
  });
}
