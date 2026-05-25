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
  const body = url ?
    '<p>Open the Personal Assistant Communication App:</p><p><a href="' + escapeReviewControllerHtml_(url) + '" target="_blank">Open Communication App</a></p>' :
    '<p>The Communication App web deployment is not available yet.</p><p>Deploy the Control Center script as a Web App, then set COMMUNICATION_APP_URL if the script cannot resolve it automatically.</p>';
  const html = HtmlService
    .createHtmlOutput('<div style="font-family:Arial,sans-serif;font-size:13px;padding:12px">' + body + '</div>')
    .setWidth(420)
    .setHeight(160);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Communication App');
}

function getCommunicationAppContext() {
  assertCommunicationAppAccess_();
  const context = buildCommunicationAppContext_();
  logCommunicationAppEvent_('load_context', {}, {
    inboxCount: context.inbox.items.length,
    pendingSignals: context.dashboard.pending.length
  });
  return context;
}

function listCommunicationInbox() {
  assertCommunicationAppAccess_();
  return buildCommunicationAppInbox_();
}

function getCommunicationDetail(selection) {
  assertCommunicationAppAccess_();
  const context = getReviewControllerContext(selection || '');
  if (!context || !context.ok) return context;
  const flowId = context.queue && context.queue.flowId || context.flow && context.flow.flowId || '';
  context.history = flowId ? getCommunicationHistory(flowId) : [];
  logCommunicationAppEvent_('load_detail', {
    selection: selection || '',
    queueId: context.queue && context.queue.queueId || '',
    flowId: flowId,
    eventKey: context.queue && context.queue.eventKey || ''
  }, {});
  return context;
}

function saveCommunicationDraft(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('save_draft', form || {}, {});
  return saveReviewControllerDraft(form || {});
}

function sendCommunicationTest(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('send_test', form || {}, {});
  return sendReviewControllerTest(form || {});
}

function approveCommunication(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('approve_live', form || {}, {});
  return approveReviewControllerSelection(form || {});
}

function discardCommunication(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('discard', form || {}, {});
  return discardReviewControllerDraft(form || {});
}

function createCommunication(form) {
  assertCommunicationAppAccess_();
  logCommunicationAppEvent_('create_communication', form || {}, {});
  return queueReviewControllerDraft(form || {});
}

function syncDashboardFromWebApp() {
  assertCommunicationAppAccess_();
  const result = syncDashboardFromCommunicationConsole({
    source: 'Communication Web App'
  });
  logCommunicationAppEvent_('manual_dashboard_sync', {}, {
    ok: result.ok,
    message: result.message || ''
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
  const inbox = buildCommunicationAppInbox_();
  const active = buildCommunicationAppActiveCommunications_();
  const dashboard = buildCommunicationAppDashboard_();
  const history = buildCommunicationAppHistory_('', 20);
  const appUrl = getCommunicationAppUrl_();
  return {
    ok: true,
    generatedAt: nowIso_(),
    user: access.email || '',
    appUrl: appUrl,
    spreadsheetId: getControlCenterSpreadsheet_().getId(),
    inbox: inbox,
    activeCommunications: active,
    dashboard: dashboard,
    history: history,
    newCommunicationOptions: buildReviewControllerNewCommunicationOptions_(),
    stats: {
      inbox: inbox.items.length,
      errors: inbox.items.filter(item => item.status === HUB.STATUS.ERROR).length,
      scheduled: inbox.items.filter(item => item.status === HUB.STATUS.SCHEDULED).length,
      pendingSignals: dashboard.pending.length,
      activeCommunications: active.length
    }
  };
}

function buildCommunicationAppInbox_() {
  const ss = getControlCenterSpreadsheet_();
  const queueSheet = ss.getSheetByName(HUB.SHEETS.QUEUE);
  const rows = queueSheet ? getObjects_(queueSheet) : [];
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
  return {
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
    hasTest: Boolean(testUrl),
    hasLive: false
  };
}

function buildCommunicationAppActiveCommunications_() {
  const ss = getControlCenterSpreadsheet_();
  const sheet = ss.getSheetByName(HUB.SHEETS.FLOW_STATE);
  const rows = sheet ? getObjects_(sheet) : [];
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

function buildCommunicationAppDashboard_() {
  const ss = getControlCenterSpreadsheet_();
  const config = readCommunicationAppConfig_(ss);
  const observations = readCommunicationAppObjects_(ss, AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS)
    .filter(row => row['Source Item ID']);
  const triggerLog = readCommunicationAppObjects_(ss, AUTOMATION.SHEETS.TRIGGER_LOG)
    .filter(row => row['Trigger Log ID'])
    .slice(0, 20);
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

function buildCommunicationAppHistory_(flowId, limit) {
  const ss = getControlCenterSpreadsheet_();
  const sheet = ss.getSheetByName(HUB.SHEETS.HISTORY);
  const rows = sheet ? getObjects_(sheet) : [];
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

function readCommunicationAppConfig_(ss) {
  const rows = readCommunicationAppObjects_(ss, AUTOMATION.SHEETS.CONFIG);
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
