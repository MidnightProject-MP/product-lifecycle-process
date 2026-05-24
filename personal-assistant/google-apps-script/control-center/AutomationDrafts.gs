function buildHubDraftFromExportChange_(row, trigger, changes, oldState, stateHash, dedupeKey) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  const owner = row.Owner || 'TPM';
  const payload = buildAutomationPayloadFromExport_(row, trigger, changes, oldState, owner);
  const specialRelease = isSpecialReleaseScheduledTrigger_(row, trigger);
  const flowId = specialRelease ? buildSpecialReleaseFlowId_(row) : row['Flow ID'];
  const lane = specialRelease || recordType === 'Release' ? 'Production Release' : 'Project';

  return {
    'Queue ID': Utilities.getUuid(),
    'Flow ID': flowId,
    'Dedupe Key': dedupeKey || ('dashboard|' + row['Source Item ID'] + '|' + trigger.eventKey + '|' + stateHash),
    'Created At': automationNowIso_(),
    'Updated At': automationNowIso_(),
    Source: 'Automation Dashboard',
    Lane: lane,
    'Event Key': trigger.eventKey,
    Status: 'Draft',
    Priority: inferAutomationPriority_(trigger.eventKey, row),
    Owner: owner,
    'Channel Override': row['Channel Override'] || '',
    'Slack Thread ID': row['Slack Thread ID'] || '',
    'Payload JSON': JSON.stringify(payload)
  };
}

function buildAutomationPayloadFromExport_(row, trigger, changes, oldState, owner) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  if (isSpecialReleaseScheduledTrigger_(row, trigger)) {
    return buildSpecialReleasePayloadFromProject_(row, trigger, changes, oldState, owner);
  }

  const subject = row.Subject || row['Source Item ID'];
  const payload = {
    subject: subject,
    owner: owner,
    project: subject,
    event_key: trigger.eventKey,
    source_item_id: row['Source Item ID'],
    what: buildAutomationWhat_(recordType, row, trigger, changes, oldState),
    so_what: inferAutomationSoWhat_(recordType, trigger.eventKey, trigger),
    whats_next: inferAutomationWhatsNext_(recordType, trigger.eventKey, trigger),
    status: row.Status || '',
    phase: row.Phase || '',
    gate: row['Next Gate'] || '',
    next_gate: row['Next Gate'] || '',
    next_gate_eta: row['Next Gate ETA'] || '',
    risk_level: row['Risk Level'] || '',
    confidence: row.Confidence || '',
    primary_risk: row['Primary Risk'] || '',
    primary_target: row['Primary Target'] || '',
    lead_pm: row['Lead PM'] || '',
    notes: row.Notes || ''
  };

  if (recordType === 'Release') {
    payload.release_id = row['Source Item ID'];
    payload.release_name = subject;
    payload.release_date = row['Release Date'];
    payload.release_status = row['Release Status'] || row.Status || row.Phase || '';
    payload.included_projects = row['Included Projects'];
    payload.known_issues = row['Known Issues'];
    payload.decision_owner = owner;
    payload.rollback_status = row['Rollback Status'];
    payload.go_no_go_required = row['Go / No-Go Required'];
  }

  return payload;
}

function buildSpecialReleasePayloadFromProject_(row, trigger, changes, oldState, owner) {
  const project = row.Subject || row['Source Item ID'];
  const releaseSubject = project + ' Special Release';
  const flowId = buildSpecialReleaseFlowId_(row);
  const leadPm = row['Lead PM'] || '';

  return {
    subject: releaseSubject,
    owner: owner,
    project: project,
    project_flow_id: row['Flow ID'] || '',
    event_key: trigger.eventKey,
    source_item_id: row['Source Item ID'],
    release_id: flowId,
    release_name: releaseSubject,
    release_date: row['Next Gate ETA'] || '',
    release_status: 'Scheduled',
    release_type: 'Special Release',
    release_owner: owner,
    lead_pm: leadPm,
    what: buildSpecialReleaseWhat_(row, oldState || {}),
    so_what: inferSpecialReleaseSoWhat_(row),
    whats_next: inferSpecialReleaseWhatsNext_(row),
    status: row.Status || '',
    phase: row.Phase || '',
    gate: row['Next Gate'] || '',
    next_gate: row['Next Gate'] || '',
    next_gate_eta: row['Next Gate ETA'] || '',
    risk_level: row['Risk Level'] || '',
    confidence: row.Confidence || '',
    primary_risk: row['Primary Risk'] || '',
    primary_target: row['Primary Target'] || '',
    notes: row.Notes || '',
    included_projects: project,
    known_issues: row['Primary Risk'] || '',
    decision_owner: owner,
    go_no_go_required: 'TRUE'
  };
}

function buildAutomationWhat_(recordType, row, trigger, changes, oldState) {
  if (isSpecialReleaseScheduledTrigger_(row, trigger)) {
    return buildSpecialReleaseWhat_(row, oldState || {});
  }
  if (recordType === 'Project') {
    return buildProjectChangeSummary_(row, oldState || {}, changes, trigger);
  }
  return buildChangeSummary_(changes);
}

function buildSpecialReleaseWhat_(row, oldState) {
  const project = row.Subject || row['Source Item ID'];
  const releaseDate = row['Next Gate ETA'] || 'TBD';
  const risk = row['Primary Risk'] || oldState['Primary Risk'] || '';
  const readiness = risk ? ' Current readiness risk: ' + risk : '';
  return 'Special release scheduled for ' + project + ' on ' + releaseDate + '.' + readiness;
}

function inferSpecialReleaseSoWhat_(row) {
  const details = [];
  if (row.Status) details.push('current project status is ' + row.Status);
  if (row.Confidence) details.push('confidence is ' + row.Confidence);
  if (row['Risk Level']) details.push('risk level is ' + row['Risk Level']);
  const context = details.length ? ' Current readiness context: ' + details.join(', ') + '.' : '';
  return 'Stakeholders should plan around a project-specific production release instead of the standard release train.' + context;
}

function inferSpecialReleaseWhatsNext_(row) {
  const parts = ['Release owner should confirm readiness and the go / no-go path before the special release window.'];
  if (row.Owner) parts.push('Release owner: ' + row.Owner + '.');
  if (row['Lead PM']) parts.push('Lead PM: ' + row['Lead PM'] + '.');
  return parts.join(' ');
}

function buildProjectChangeSummary_(row, oldState, changes, trigger) {
  const candidate = String(trigger.candidate || '');
  const reason = row['Primary Risk'] || oldState['Primary Risk'] || 'No primary risk is listed yet.';

  if (candidate === 'Project primary target cleared') {
    return 'Primary target cleared: ' + (row['Primary Target'] || oldState['Primary Target'] || 'target') +
      '. Current phase moved from "' + (oldState.Phase || 'blank') + '" to "' + (row.Phase || 'blank') +
      '"; next gate is "' + (row['Next Gate'] || 'blank') + '" with ETA "' + (row['Next Gate ETA'] || 'blank') + '".';
  }

  if (candidate === 'Project gate cleared') {
    return 'Gate cleared: "' + (oldState['Next Gate'] || 'previous gate') + '". Current phase moved from "' +
      (oldState.Phase || 'blank') + '" to "' + (row.Phase || 'blank') + '"; next gate is "' +
      (row['Next Gate'] || 'blank') + '" with ETA "' + (row['Next Gate ETA'] || 'blank') + '".';
  }

  if (candidate === 'Project back on track') {
    return 'Status moved back to green from "' + (oldState.Status || 'blank') +
      '". Reason / context: ' + reason;
  }

  if (candidate === 'Material project status change') {
    return 'Status changed from "' + (oldState.Status || 'blank') + '" to "' + (row.Status || 'blank') +
      '". Primary risk / reason: ' + reason;
  }

  if (candidate === 'Project next gate ETA changed') {
    return 'Next gate timing changed for "' + (row['Next Gate'] || oldState['Next Gate'] || 'the next gate') +
      '": ETA moved from "' + (oldState['Next Gate ETA'] || 'blank') + '" to "' +
      (row['Next Gate ETA'] || 'blank') + '". Reason / context: ' + reason;
  }

  if (candidate === 'Project primary target changed') {
    return 'Primary target changed from "' + (oldState['Primary Target'] || 'blank') + '" to "' +
      (row['Primary Target'] || 'blank') + '". Reason / context: ' + reason;
  }

  return buildChangeSummary_(changes);
}

function buildChangeSummary_(changes) {
  if (!changes.length) return 'Dashboard state changed.';
  return changes.slice(0, 5).map(change =>
    change.field + ' changed from "' + (change.oldValue || 'blank') + '" to "' + (change.newValue || 'blank') + '".'
  ).join(' ');
}

function summarizeAutomationExportRow_(row) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  if (recordType === 'Release') {
    return [
      row.Subject || row['Source Item ID'],
      row['Release Date'] || '',
      row['Release Status'] || row.Status || row.Phase || ''
    ].filter(Boolean).join(' | ');
  }
  return [
    row.Subject || row['Source Item ID'],
    row.Status || '',
    row.Phase || '',
    row['Risk Level'] || row['Primary Risk'] || ''
  ].filter(Boolean).join(' | ');
}

function summarizeAutomationState_(state) {
  if (!state) return '';
  return [
    state.Subject || state['Source Item ID'] || '',
    state.Status || state['Release Status'] || '',
    state.Phase || '',
    state['Risk Level'] || state['Primary Risk'] || ''
  ].filter(Boolean).join(' | ');
}

function inferAutomationSoWhat_(recordType, eventKey, trigger) {
  if (trigger && trigger.candidate === 'Special release scheduled') {
    return 'Stakeholders should plan around a project-specific production release instead of the standard release train.';
  }

  if (recordType === 'Release') {
    if (eventKey === 'release.rolled_back') return 'Stakeholders need a clear production state and recovery expectation.';
    if (eventKey === 'release.delayed') return 'Stakeholders need to adjust release expectations, support readiness, and timing.';
    return 'This release update may affect production timing, support readiness, monitoring, or stakeholder expectations.';
  }

  const candidate = trigger && trigger.candidate || '';
  if (candidate === 'Project primary target cleared') {
    return 'Stakeholders should know the project reached its primary target; any further rollout work can be tracked separately.';
  }
  if (candidate === 'Project gate cleared') {
    return 'Stakeholders should know the project advanced and expectations have shifted to the next gate.';
  }
  if (candidate === 'Project back on track') {
    return 'Stakeholders should know the project is back on track and the prior risk has been reduced.';
  }
  if (candidate === 'Project next gate ETA changed' || candidate === 'Project primary target changed') {
    return 'Stakeholders need updated timing or target expectations for planning and dependency management.';
  }

  return 'This may affect project expectations, risk, timeline, release, or stakeholder confidence.';
}

function inferAutomationWhatsNext_(recordType, eventKey, trigger) {
  if (trigger && trigger.candidate === 'Special release scheduled') {
    return 'Release owner should confirm readiness and the go / no-go path before the special release window.';
  }

  if (recordType === 'Release') {
    if (eventKey === 'release.go_no_go') return 'Release owner should confirm readiness and the go / no-go decision.';
    if (eventKey === 'release.rolled_back') return 'Release owner should confirm recovery status and whether a postmortem is needed.';
    return 'Release owner should review readiness, confirm impact, and approve or discard this draft.';
  }

  const candidate = trigger && trigger.candidate || '';
  if (candidate === 'Project primary target cleared') {
    return 'Lead PM should confirm whether the project can be marked complete or whether additional rollout phases remain.';
  }
  if (candidate === 'Project gate cleared') {
    return 'Lead PM should confirm the next gate, ETA, and any readiness needs before approving this update.';
  }
  if (candidate === 'Project back on track') {
    return 'Lead PM should confirm the risk is resolved or contained and approve the back-on-track update.';
  }
  if (candidate === 'Project next gate ETA changed' || candidate === 'Project primary target changed') {
    return 'Lead PM should confirm the reason, updated timing, and stakeholder impact before approving this update.';
  }

  return 'Lead PM or TPM should review the change, confirm impact, and approve or discard this draft.';
}

function inferAutomationPriority_(eventKey, row) {
  if (eventKey === 'release.rolled_back') return 'Critical';
  if (eventKey === 'release.delayed' || eventKey === 'release.go_no_go') return 'High';
  if (String(row.Status || '').toUpperCase() === 'RED') return 'High';
  if (['HIGH', 'CRITICAL'].indexOf(normalizeRiskLevel_(row['Risk Level'])) >= 0) return 'High';
  return 'Medium';
}

function isSpecialReleaseScheduledTrigger_(row, trigger) {
  return normalizeAutomationRecordType_(row['Record Type']) === 'Project' &&
    trigger &&
    trigger.eventKey === 'release.scheduled' &&
    trigger.candidate === 'Special release scheduled';
}

function buildSpecialReleaseFlowId_(row) {
  const source = row['Source Item ID'] || row['Flow ID'] || row.Subject || 'special-release';
  return 'rel-special-' + normalizeAutomationSlug_(source);
}

function insertHubDraftFromAutomationAtTop_(draft) {
  const hub = SpreadsheetApp.getActive();
  const queue = hub.getSheetByName('Queue');
  if (!queue) throw new Error('Hub Queue sheet is missing.');

  const duplicateQueueId = findHubActiveQueueIdByDedupeKey_(queue, draft['Dedupe Key']);
  if (duplicateQueueId) return duplicateQueueId;

  const headers = getAutomationHeaders_(queue);
  insertAutomationValuesAtTop_(queue, headers.map(header => draft[header] == null ? '' : draft[header]));
  autoSendQueueDraftTestSafe_(draft['Queue ID'], draft);
  syncReviewSheetFromQueueSafe_();
  return draft['Queue ID'];
}

function findHubActiveQueueIdByDedupeKey_(queue, dedupeKey) {
  if (!dedupeKey) return '';
  const rows = getAutomationObjects_(queue);
  const active = rows.find(row =>
    row['Dedupe Key'] === dedupeKey &&
    ['Draft', 'Approved', 'Scheduled'].indexOf(row.Status) >= 0
  );
  return active ? active['Queue ID'] : '';
}
