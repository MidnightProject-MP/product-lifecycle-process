function openReviewController() {
  const html = buildReviewControllerHtml_()
    .setWidth(640)
    .setHeight(680);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Review Controller');
}

function openReviewControllerSidebar() {
  const html = buildReviewControllerHtml_()
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function buildReviewControllerHtml_() {
  return HtmlService.createHtmlOutputFromFile('ReviewControllerSidebar')
    .setTitle('Review Controller')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getReviewControllerContext() {
  return getReviewControllerContextForQueueId_('');
}

function saveReviewControllerDraft(form) {
  const result = runSkillOrThrow_('save_review_draft', {
    queueId: form && form.queueId,
    form: form || {}
  });

  return getReviewControllerContextForQueueId_(result.queueId);
}

function approveReviewControllerDraft(form) {
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
  const action = String(form && form.flowAction || '').trim();
  if (action && action !== 'selected') {
    const queued = createReviewControllerFlowActionDraft(form || {});
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

function discardReviewControllerDraft(form) {
  const reason = form && form.discardReason ? String(form.discardReason) : 'Discarded from Review Controller.';
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

function createReviewControllerFlowActionDraft(form) {
  const result = withReviewControllerQueueRow_(form && form.queueId, function(queueSheet, row) {
    const selectedItem = getRowObject_(queueSheet, row);
    const flowId = selectedItem['Flow ID'];
    if (!flowId) throw new Error('Selected draft does not belong to a flow yet.');

    const flow = findFlowStateByFlowId_(flowId);
    if (!flow) throw new Error('Flow not found in Flow_State: ' + flowId);

    const action = String(form && form.flowAction || '').trim();
    if (!action || action === 'selected') {
      throw new Error('Choose an expected path or detour action first.');
    }

    const eventKey = resolveFlowConsoleEventKey_(flow, action);
    if (!eventKey) throw new Error('No event could be resolved for action: ' + action);

    const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey);
    if (!event) throw new Error('Registry is missing Event_Catalog row for: ' + eventKey);

    const values = buildReviewControllerFlowValues_(form || {}, selectedItem);
    const payload = buildFlowConsolePayload_(flow, values, eventKey);
    const priority = values.Priority || event.Severity || selectedItem.Priority || 'Medium';
    const draft = {
      Source: 'Review Controller',
      Lane: flow['Flow Type'] || event.Lane || inferLaneFromEventKey_(eventKey),
      'Event Key': eventKey,
      Status: HUB.STATUS.DRAFT,
      Priority: priority,
      Owner: values.Owner || flow.Owner || payload.owner || '',
      'Flow ID': flowId,
      'Dedupe Key': buildFlowConsoleDedupeKey_(flow, eventKey, payload),
      'Parent Queue ID': flow['Last Queue ID'] || selectedItem['Queue ID'] || '',
      'Expected Previous Event Key': flow['Current Event Key'] || '',
      'Path Override': action === HUB.FLOW_ACTION.CONTINUE ? 'Happy Path' : 'Sad Path',
      'Payload JSON': stringifyJson_(payload)
    };

    const queueId = upsertFlowConsoleDraft_(draft);
    if (action !== HUB.FLOW_ACTION.CONTINUE) {
      archiveScheduledDraftsForFlowExceptEvent_(flowId, eventKey, 'Superseded by Review Controller detour draft ' + queueId);
    }
    syncReviewSheetFromQueueSafe_();
    logHub_('INFO', 'createReviewControllerFlowActionDraft', queueId, 'Review Controller created flow action draft.', {
      flowId: flowId,
      action: action,
      eventKey: eventKey
    });
    return queueId;
  });

  return getReviewControllerContextForQueueId_(result.queueId);
}

function getReviewControllerContextForQueueId_(queueId) {
  try {
    const resolved = resolveReviewControllerSelection_(queueId);
    const queueSheet = resolved.queueSheet;
    const row = resolved.row;
    const item = getRowObject_(queueSheet, row);
    const payload = normalizePayload_(item);
    const flow = findFlowStateByFlowId_(item['Flow ID']);

    return {
      ok: true,
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
        owner: item.Owner || payload.owner || '',
        subject: getReviewControllerSubject_(item, payload),
        what: payload.what || '',
        soWhat: payload.so_what || '',
        whatsNext: payload.whats_next || '',
        slackUrl: item['Slack Message URL'] || ''
      },
      flow: buildReviewControllerFlowContext_(flow),
      actions: buildReviewControllerActions_(item, flow),
      message: ''
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || String(error)
    };
  }
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
  payload.what = stringFromForm_(form.what);
  payload.so_what = stringFromForm_(form.soWhat);
  payload.whats_next = stringFromForm_(form.whatsNext);
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

function buildReviewControllerFlowValues_(form, item) {
  return {
    'What changed?': stringFromForm_(form.what) || normalizePayload_(item).what || '',
    'Why it matters': stringFromForm_(form.soWhat) || normalizePayload_(item).so_what || '',
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
      anchorUrl: ''
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
    status: flow['Flow Status'] || ''
  };
}

function buildReviewControllerActions_(item, flow) {
  const selectedDefaults = buildReviewControllerSelectedDefaults_(item);
  const actions = [{
    value: 'selected',
    label: 'Use selected draft: ' + getReviewControllerEventDisplayName_(item['Event Key']),
    eventKey: item['Event Key'] || '',
    defaults: selectedDefaults
  }];

  if (!flow) return actions;

  getAvailableFlowConsoleActions_(flow).forEach(action => {
    const eventKey = resolveFlowConsoleEventKey_(flow, action);
    if (!eventKey) return;
    actions.push({
      value: action,
      label: action + ': ' + getReviewControllerEventDisplayName_(eventKey),
      eventKey: eventKey,
      defaults: buildReviewControllerActionDefaults_(item, flow, eventKey, action)
    });
  });

  return actions.filter((action, index, list) =>
    list.findIndex(candidate => candidate.value === action.value && candidate.eventKey === action.eventKey) === index
  );
}

function buildReviewControllerSelectedDefaults_(item) {
  const payload = normalizePayload_(item);
  return {
    what: payload.what || '',
    soWhat: payload.so_what || '',
    whatsNext: payload.whats_next || ''
  };
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

function getReviewControllerSubject_(item, payload) {
  return payload.subject ||
    payload.project ||
    payload.release_name ||
    payload.issue_title ||
    payload.release_id ||
    item['Flow ID'] ||
    '';
}

function getReviewControllerEventDisplayName_(eventKey) {
  const event = findCachedReviewControllerRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  if (event && event['Communication Event']) return event['Communication Event'];

  const labels = {
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
  if (labels[eventKey]) return labels[eventKey];

  const parts = String(eventKey || '').split('.');
  const key = parts.length > 1 ? parts.slice(1).join(' ') : String(eventKey || 'Update');
  return key
    .replace(/_/g, ' ')
    .replace(/\bqa\b/gi, 'QA')
    .replace(/\bapi\b/gi, 'API')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function describeReviewControllerEventKeyList_(eventKeys) {
  const keys = String(eventKeys || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value);
  if (!keys.length) return 'No detours configured';
  return keys.map(getReviewControllerEventDisplayName_).join(', ');
}

function findCachedReviewControllerRegistryRow_(sheetName, keyField, keyValue) {
  const rows = getCachedRegistryObjects_(sheetName) || [];
  return rows.find(row => String(row[keyField]) === String(keyValue)) || null;
}

function stringFromForm_(value) {
  return value == null ? '' : String(value).trim();
}
