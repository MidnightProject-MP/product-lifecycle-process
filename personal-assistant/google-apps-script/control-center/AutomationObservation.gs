function processAutomationExportRows_(automation, config, rows, options) {
  const result = {
    processedRows: 0,
    changedRows: 0,
    hubDraftsCreated: 0,
    pendingEvaluations: 0,
    skippedRows: 0,
    errors: 0
  };
  const context = createAutomationProcessingContext_(automation, options && options.observationRows);

  rows.forEach(row => {
    result.processedRows++;
    const processed = processAutomationExportRow_(automation, config, row, context);
    if (processed.changed) result.changedRows++;
    if (processed.hubDraftCreated) result.hubDraftsCreated++;
    if (processed.skipped) result.skippedRows++;
    if (processed.error) result.errors++;
  });

  flushAutomationProcessingContext_(automation, context);
  result.pendingEvaluations = countPendingDashboardEvaluations_(context.observationsBySourceItemId);

  return result;
}

function createAutomationProcessingContext_(automation, observationRows) {
  observationRows = observationRows || readDashboardObservationRows_(automation);
  return {
    now: automationNowIso_(),
    hasExistingObservations: observationRows.length > 0,
    observationsBySourceItemId: buildDashboardObservationMap_(observationRows),
    snapshots: [],
    changes: [],
    triggerLogs: []
  };
}

function flushAutomationProcessingContext_(automation, context) {
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS),
    AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS,
    context.snapshots
  );
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES),
    AUTOMATION.HEADERS.DASHBOARD_CHANGES,
    context.changes
  );
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG),
    AUTOMATION.HEADERS.TRIGGER_LOG,
    context.triggerLogs
  );
  rewriteAutomationObjects_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS),
    AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS,
    Object.keys(context.observationsBySourceItemId).map(key => context.observationsBySourceItemId[key])
  );
}

function readDashboardObservationRows_(automation) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return getAutomationObjectsByHeaders_(sheet, AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS)
    .filter(row => Object.keys(row).some(key => row[key] !== ''));
}

function buildDashboardObservationMap_(rows) {
  return rows.reduce((obj, row) => {
    const sourceItemId = String(row['Source Item ID'] || '').trim();
    if (sourceItemId) obj[sourceItemId] = row;
    return obj;
  }, {});
}

function buildDashboardObservationRow_(row, stateHash, stateJson, options) {
  const opts = options || {};
  return clearPendingDashboardEvaluation_({
    'Source Item ID': row['Source Item ID'] || '',
    'Flow ID': row['Flow ID'] || '',
    'Record Type': normalizeAutomationRecordType_(row['Record Type']),
    Subject: row.Subject || '',
    'State Hash': stateHash || '',
    'State JSON': stateJson || '',
    'Last Observed At': opts.lastObservedAt || '',
    'Last Processed At': opts.lastProcessedAt || '',
    'Last Trigger Log ID': opts.lastTriggerLogId || '',
    'Processing Status': opts.processingStatus || '',
    'Processing Error': opts.processingError || ''
  });
}

function shouldUsePendingDashboardEvaluation_(recordType, changes, trigger) {
  if (trigger && trigger.eventKey) return true;
  if (recordType !== 'Project') return false;

  const signalFields = {
    Status: true,
    Phase: true,
    'Next Gate': true,
    'Next Gate ETA': true,
    'Primary Target': true
  };
  return changes.some(change => signalFields[change.field]);
}

function buildPendingDashboardEvaluation_(observation, row, stateHash, stateJson, trigger, now) {
  const samePendingHash = observation && String(observation['Pending State Hash'] || '') === String(stateHash);
  return {
    stateHash: stateHash,
    stateJson: stateJson,
    since: samePendingHash ? observation['Pending Since'] || now : now,
    lastSeenAt: now,
    stablePolls: samePendingHash ? Number(observation['Pending Stable Polls'] || 0) + 1 : 1,
    triggerCandidate: trigger.candidate || 'Potential multi-field project signal',
    eventKey: trigger.eventKey || ''
  };
}

function applyPendingDashboardEvaluation_(observation, row, pending, triggerId, processingStatus, now, processingError) {
  const base = observation || buildDashboardObservationRow_(row, '', '{}', {});
  return Object.assign(base, {
    'Source Item ID': row['Source Item ID'] || base['Source Item ID'] || '',
    'Flow ID': row['Flow ID'] || base['Flow ID'] || '',
    'Record Type': normalizeAutomationRecordType_(row['Record Type'] || base['Record Type']),
    Subject: row.Subject || base.Subject || '',
    'Last Observed At': now,
    'Last Trigger Log ID': triggerId || base['Last Trigger Log ID'] || '',
    'Processing Status': processingStatus || 'Pending Evaluation',
    'Processing Error': processingError || '',
    'Pending State Hash': pending.stateHash || '',
    'Pending State JSON': pending.stateJson || '',
    'Pending Since': pending.since || now,
    'Pending Last Seen At': pending.lastSeenAt || now,
    'Pending Stable Polls': String(pending.stablePolls || 1),
    'Pending Trigger Candidate': pending.triggerCandidate || '',
    'Pending Event Key': pending.eventKey || ''
  });
}

function clearPendingDashboardEvaluation_(observation) {
  return Object.assign(observation || {}, {
    'Pending State Hash': '',
    'Pending State JSON': '',
    'Pending Since': '',
    'Pending Last Seen At': '',
    'Pending Stable Polls': '',
    'Pending Trigger Candidate': '',
    'Pending Event Key': ''
  });
}

function hasPendingDashboardEvaluation_(observation) {
  return Boolean(observation && observation['Pending State Hash']);
}

function countPendingDashboardEvaluations_(observationsBySourceItemId) {
  return Object.keys(observationsBySourceItemId || {}).filter(key =>
    hasPendingDashboardEvaluation_(observationsBySourceItemId[key])
  ).length;
}

function getDashboardStablePolls_(config) {
  return Math.max(1, Number(config.DASHBOARD_STABLE_POLLS || 2));
}

function buildAutomationFastChangePreflight_(automation, config) {
  if (String(config.FAST_CHANGE_INDEX_ENABLED || 'TRUE').toUpperCase() === 'FALSE') {
    return {
      mode: 'Full',
      reason: 'Fast change index disabled.',
      indexHealthy: false,
      rowCount: 0,
      observationRows: null
    };
  }

  const observationRows = readDashboardObservationRows_(automation);
  const hasPendingEvaluation = observationRows.some(hasPendingDashboardEvaluation_);
  const index = readAutomationChangeIndex_(automation);
  if (!index.ok) {
    return {
      mode: 'Full',
      reason: index.message,
      indexHealthy: false,
      rowCount: index.rowCount || 0,
      hasPendingEvaluation: hasPendingEvaluation,
      observationRows: observationRows
    };
  }

  if (hasPendingEvaluation) {
    return {
      mode: 'Full',
      reason: 'Pending dashboard evaluation exists.',
      indexHealthy: true,
      hash: index.hash,
      rowCount: index.rowCount,
      hasPendingEvaluation: true,
      observationRows: observationRows
    };
  }

  if (!observationRows.length) {
    return {
      mode: 'Full',
      reason: 'No dashboard observation baseline exists.',
      indexHealthy: true,
      hash: index.hash,
      rowCount: index.rowCount,
      hasPendingEvaluation: false,
      observationRows: observationRows
    };
  }

  const lastHash = String(config.LAST_CHANGE_INDEX_HASH || '').trim();
  if (lastHash && lastHash === index.hash) {
    return {
      mode: 'Fast Skip',
      reason: 'No source changes detected.',
      indexHealthy: true,
      hash: index.hash,
      rowCount: index.rowCount,
      hasPendingEvaluation: false,
      observationRows: observationRows
    };
  }

  return {
    mode: 'Full',
    reason: lastHash ? 'Change index changed.' : 'No prior change index hash.',
    indexHealthy: true,
    hash: index.hash,
    rowCount: index.rowCount,
    hasPendingEvaluation: false,
    observationRows: observationRows
  };
}

function readAutomationChangeIndex_(automation) {
  const sheet = automation.getSheetByName(AUTOMATION.SHEETS.CHANGE_INDEX);
  if (!sheet) {
    return { ok: false, message: 'Missing Automation_Change_Index sheet.', rowCount: 0 };
  }

  const headerValidation = validateAutomationChangeIndexHeaders_(sheet);
  if (!headerValidation.ok) return headerValidation;

  if (!sheet.getRange(2, 1).getFormula()) {
    return { ok: false, message: 'Automation_Change_Index formula is missing.', rowCount: 0 };
  }

  const rows = getAutomationObjectsByHeaders_(sheet, AUTOMATION.HEADERS.CHANGE_INDEX)
    .filter(row => Object.keys(row).some(key => row[key] !== ''));
  const error = findAutomationErrorTokenInObjects_(rows);
  if (error) {
    return { ok: false, message: 'Automation_Change_Index contains ' + error + '.', rowCount: rows.length };
  }

  const activeRows = rows
    .filter(row => String(row['Source Item ID'] || '').trim())
    .filter(row => !isExplicitlyInactive_(row.Active))
    .map(row => ({
      'Source Item ID': String(row['Source Item ID'] || '').trim(),
      'Flow ID': String(row['Flow ID'] || '').trim(),
      'Record Type': normalizeAutomationRecordType_(row['Record Type']),
      Active: String(row.Active || '').trim(),
      'Source Row': String(row['Source Row'] || '').trim(),
      'Source Signature': String(row['Source Signature'] || '').trim(),
      'Signal Signature': String(row['Signal Signature'] || '').trim()
    }));

  if (!activeRows.length) {
    return { ok: false, message: 'Automation_Change_Index has no active rows.', rowCount: 0 };
  }

  const invalid = activeRows.find(row =>
    !row['Source Item ID'] ||
    !row['Flow ID'] ||
    ['Project', 'Release'].indexOf(row['Record Type']) < 0 ||
    !row['Source Signature'] ||
    !row['Signal Signature']
  );
  if (invalid) {
    return {
      ok: false,
      message: 'Automation_Change_Index has an incomplete active row for Source Item ID: ' +
        (invalid['Source Item ID'] || 'blank') + '.',
      rowCount: activeRows.length
    };
  }

  const hashInput = activeRows
    .map(row => AUTOMATION.HEADERS.CHANGE_INDEX.map(header => row[header] || '').join('\u001e'))
    .sort()
    .join('\u001f');

  return {
    ok: true,
    message: 'Automation_Change_Index is healthy.',
    rowCount: activeRows.length,
    hash: hashString_(hashInput)
  };
}

function validateAutomationChangeIndexHeaders_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, AUTOMATION.HEADERS.CHANGE_INDEX.length)
    .getDisplayValues()[0]
    .map(value => String(value || '').trim());
  for (let i = 0; i < AUTOMATION.HEADERS.CHANGE_INDEX.length; i++) {
    if (headers[i] !== AUTOMATION.HEADERS.CHANGE_INDEX[i]) {
      return {
        ok: false,
        message: 'Automation_Change_Index header mismatch at column ' + (i + 1) +
          '. Expected "' + AUTOMATION.HEADERS.CHANGE_INDEX[i] + '", found "' + headers[i] + '".',
        rowCount: 0
      };
    }
  }
  return { ok: true, message: 'Automation_Change_Index headers valid.', rowCount: 0 };
}

function findAutomationErrorTokenInObjects_(rows) {
  const tokens = ['#REF!', '#N/A', '#VALUE!', '#NULL!', '#LOADING!'];
  for (let r = 0; r < rows.length; r++) {
    const values = Object.keys(rows[r]).map(key => String(rows[r][key] || '').toUpperCase());
    for (let v = 0; v < values.length; v++) {
      for (let t = 0; t < tokens.length; t++) {
        if (values[v].indexOf(tokens[t]) >= 0) return tokens[t];
      }
    }
  }
  return '';
}

function projectSignalNeedsPrimaryRisk_(recordType, trigger, row, config) {
  if (recordType !== 'Project') return false;
  if (String(config.REQUIRE_PROJECT_PRIMARY_RISK || 'TRUE').toUpperCase() !== 'TRUE') return false;
  if (!trigger || trigger.eventKey !== 'project.unexpected_status_change') return false;
  return !String(row['Primary Risk'] || '').trim();
}

function processAutomationExportRow_(automation, config, row, context) {
  const now = context.now || automationNowIso_();
  const sourceItemId = String(row['Source Item ID'] || '').trim();
  const flowId = String(row['Flow ID'] || '').trim();
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  const state = buildAutomationExportState_(row);
  const stateJson = JSON.stringify(state);
  const stateHash = hashString_(stateJson);
  const observation = context.observationsBySourceItemId[sourceItemId] || null;

  context.snapshots.push(buildDashboardSnapshotRow_(row, stateHash, stateJson, now));

  if (!observation && !context.hasExistingObservations) {
    context.observationsBySourceItemId[sourceItemId] = buildDashboardObservationRow_(row, stateHash, stateJson, {
      lastObservedAt: now,
      lastProcessedAt: now,
      lastTriggerLogId: '',
      processingStatus: 'Baseline',
      processingError: ''
    });
    return { changed: false, hubDraftCreated: false, skipped: false, error: false };
  }

  if (observation && String(observation['Flow ID'] || '') !== flowId) {
    const triggerId = queueAutomationTriggerLog_(context, {
      'Work Item Type': recordType,
      'Flow ID': flowId,
      'Source Row Key': sourceItemId,
      'Trigger Candidate': 'Flow ID changed for existing source item',
      'Event Key': '',
      'Old State Hash': observation['State Hash'] || '',
      'New State Hash': stateHash,
      'Old State Summary': summarizeAutomationState_(parseJsonObject_(observation['State JSON'])),
      'New State Summary': summarizeAutomationExportRow_(row),
      'Dedupe Key': '',
      'Hub Queue ID': '',
      'Processing Status': 'Error',
      'Processed At': now,
      'Processing Error': 'Source Item ID ' + sourceItemId + ' changed Flow ID from ' +
        observation['Flow ID'] + ' to ' + flowId + '.'
    });
    context.changes = context.changes.concat(buildDashboardChangeRows_(row, observation, stateHash, [{
      field: 'Flow ID',
      oldValue: observation['Flow ID'] || '',
      newValue: flowId
    }], {
      triggerCandidate: 'Flow ID changed for existing source item',
      eventKey: '',
      dedupeKey: '',
      processingStatus: 'Error',
      processedAt: now,
      processingError: 'Identity mismatch',
      triggerLogId: triggerId
    }));
    return { changed: true, hubDraftCreated: false, skipped: false, error: true };
  }

  if (observation && String(observation['State Hash'] || '') === stateHash) {
    if (hasPendingDashboardEvaluation_(observation)) {
      const triggerId = queueAutomationTriggerLog_(context, {
        'Work Item Type': recordType,
        'Flow ID': flowId,
        'Source Row Key': sourceItemId,
        'Trigger Candidate': observation['Pending Trigger Candidate'] || 'Signal reverted before stable evaluation',
        'Event Key': observation['Pending Event Key'] || '',
        'Old State Hash': observation['State Hash'] || '',
        'New State Hash': stateHash,
        'Old State Summary': summarizeAutomationState_(parseJsonObject_(observation['State JSON'])),
        'New State Summary': summarizeAutomationExportRow_(row),
        'Dedupe Key': '',
        'Hub Queue ID': '',
        'Processing Status': 'Signal Reverted',
        'Processed At': now,
        'Processing Error': ''
      });
      context.observationsBySourceItemId[sourceItemId] = clearPendingDashboardEvaluation_(Object.assign(observation, {
        'Last Observed At': now,
        'Last Processed At': now,
        'Last Trigger Log ID': triggerId,
        'Processing Status': 'Signal Reverted',
        'Processing Error': ''
      }));
      return { changed: true, hubDraftCreated: false, skipped: true, error: false };
    }

    context.observationsBySourceItemId[sourceItemId] = Object.assign(observation, {
      'Last Observed At': now,
      'Processing Status': 'No Change',
      'Processing Error': ''
    });
    return { changed: false, hubDraftCreated: false, skipped: false, error: false };
  }

  const oldState = observation ? parseJsonObject_(observation['State JSON']) : {};
  const changes = diffAutomationStates_(oldState, state);
  const trigger = inferAutomationExportTrigger_(row, oldState, changes);
  const needsPendingEvaluation = shouldUsePendingDashboardEvaluation_(recordType, changes, trigger);

  if (needsPendingEvaluation) {
    const pending = buildPendingDashboardEvaluation_(observation, row, stateHash, stateJson, trigger, now);
    if (pending.stablePolls < getDashboardStablePolls_(config)) {
      const triggerId = queueAutomationTriggerLog_(context, {
        'Work Item Type': recordType,
        'Flow ID': flowId,
        'Source Row Key': sourceItemId,
        'Trigger Candidate': trigger.candidate || 'Potential multi-field project signal',
        'Event Key': trigger.eventKey || '',
        'Old State Hash': observation && observation['State Hash'] || '',
        'New State Hash': stateHash,
        'Old State Summary': summarizeAutomationState_(oldState),
        'New State Summary': summarizeAutomationExportRow_(row),
        'Dedupe Key': '',
        'Hub Queue ID': '',
        'Processing Status': 'Pending Evaluation',
        'Processed At': now,
        'Processing Error': ''
      });
      context.changes = context.changes.concat(buildDashboardChangeRows_(row, observation, stateHash, changes, {
        triggerCandidate: trigger.candidate || 'Potential multi-field project signal',
        eventKey: trigger.eventKey || '',
        dedupeKey: '',
        processingStatus: 'Pending Evaluation',
        processedAt: now,
        processingError: '',
        triggerLogId: triggerId
      }));
      context.observationsBySourceItemId[sourceItemId] = applyPendingDashboardEvaluation_(
        observation,
        row,
        pending,
        triggerId,
        'Pending Evaluation',
        now
      );
      return { changed: true, hubDraftCreated: false, skipped: true, error: false };
    }

    if (projectSignalNeedsPrimaryRisk_(recordType, trigger, row, config)) {
      const triggerId = queueAutomationTriggerLog_(context, {
        'Work Item Type': recordType,
        'Flow ID': flowId,
        'Source Row Key': sourceItemId,
        'Trigger Candidate': trigger.candidate,
        'Event Key': trigger.eventKey,
        'Old State Hash': observation && observation['State Hash'] || '',
        'New State Hash': stateHash,
        'Old State Summary': summarizeAutomationState_(oldState),
        'New State Summary': summarizeAutomationExportRow_(row),
        'Dedupe Key': '',
        'Hub Queue ID': '',
        'Processing Status': 'Needs Reason',
        'Processed At': now,
        'Processing Error': 'Primary Risk is required before creating a project communication draft.'
      });
      context.observationsBySourceItemId[sourceItemId] = applyPendingDashboardEvaluation_(
        observation,
        row,
        pending,
        triggerId,
        'Needs Reason',
        now,
        'Primary Risk is required before creating a project communication draft.'
      );
      return { changed: true, hubDraftCreated: false, skipped: true, error: false };
    }
  }

  const manualReview = isTruthy_(row['Manual Review']);
  const createHubDrafts = String(config.CREATE_HUB_DRAFTS || 'FALSE').toUpperCase() === 'TRUE';
  const dedupeKey = trigger.eventKey ? 'dashboard|' + sourceItemId + '|' + trigger.eventKey + '|' + stateHash : '';
  let hubQueueId = '';
  let processingStatus = '';
  let processingError = '';
  let skipped = false;
  let error = false;

  if (!trigger.eventKey) {
    processingStatus = 'Logged Only';
    skipped = true;
  } else if (manualReview) {
    processingStatus = 'Skipped - Manual Review';
    skipped = true;
  } else if (!createHubDrafts) {
    processingStatus = 'Skipped - Hub Drafts Disabled';
    skipped = true;
  } else {
    try {
      hubQueueId = insertHubDraftFromAutomationAtTop_(
        buildHubDraftFromExportChange_(row, trigger, changes, oldState, stateHash, dedupeKey)
      );
      processingStatus = 'Draft Created';
    } catch (draftError) {
      processingStatus = 'Error';
      processingError = draftError.message || String(draftError);
      error = true;
    }
  }

  const triggerId = queueAutomationTriggerLog_(context, {
    'Work Item Type': recordType,
    'Flow ID': flowId,
    'Source Row Key': sourceItemId,
    'Trigger Candidate': trigger.candidate,
    'Event Key': trigger.eventKey,
    'Old State Hash': observation && observation['State Hash'] || '',
    'New State Hash': stateHash,
    'Old State Summary': summarizeAutomationState_(oldState),
    'New State Summary': summarizeAutomationExportRow_(row),
    'Dedupe Key': dedupeKey,
    'Hub Queue ID': hubQueueId,
    'Processing Status': processingStatus,
    'Processed At': now,
    'Processing Error': processingError
  });

  context.changes = context.changes.concat(buildDashboardChangeRows_(row, observation, stateHash, changes, {
    triggerCandidate: trigger.candidate,
    eventKey: trigger.eventKey,
    dedupeKey: dedupeKey,
    processingStatus: processingStatus,
    processedAt: now,
    processingError: processingError,
    triggerLogId: triggerId
  }));

  if (!error) {
    context.observationsBySourceItemId[sourceItemId] = clearPendingDashboardEvaluation_(
      buildDashboardObservationRow_(row, stateHash, stateJson, {
        lastObservedAt: now,
        lastProcessedAt: now,
        lastTriggerLogId: triggerId,
        processingStatus: processingStatus,
        processingError: ''
      })
    );
  }

  return {
    changed: true,
    hubDraftCreated: Boolean(hubQueueId),
    skipped: skipped,
    error: error
  };
}

function recordDashboardSnapshot_(automation, row, stateHash, stateJson, timestamp) {
  insertByHeadersAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS),
    AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS,
    buildDashboardSnapshotRow_(row, stateHash, stateJson, timestamp)
  );
}

function buildDashboardSnapshotRow_(row, stateHash, stateJson, timestamp) {
  return {
    'Snapshot ID': Utilities.getUuid(),
    'Snapshot At': timestamp,
    'Record Type': normalizeAutomationRecordType_(row['Record Type']),
    'Source Item ID': row['Source Item ID'],
    'Flow ID': row['Flow ID'],
    'State Hash': stateHash,
    'State JSON': stateJson
  };
}

function recordDashboardChangeRows_(automation, row, observation, newStateHash, changes, context) {
  insertAutomationObjectsAtTop_(
    automation.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES),
    AUTOMATION.HEADERS.DASHBOARD_CHANGES,
    buildDashboardChangeRows_(row, observation, newStateHash, changes, context)
  );
}

function buildDashboardChangeRows_(row, observation, newStateHash, changes, context) {
  const oldStateHash = observation && observation['State Hash'] || '';
  const now = context.processedAt || automationNowIso_();

  return changes.map(change => {
    return {
      'Change ID': Utilities.getUuid(),
      'Detected At': now,
      'Record Type': normalizeAutomationRecordType_(row['Record Type']),
      'Source Item ID': row['Source Item ID'],
      'Flow ID': row['Flow ID'],
      Field: change.field,
      'Old Value': change.oldValue,
      'New Value': change.newValue,
      'Old State Hash': oldStateHash,
      'New State Hash': newStateHash,
      'Trigger Candidate': context.triggerCandidate || '',
      'Event Key': context.eventKey || '',
      'Dedupe Key': context.dedupeKey || '',
      'Processing Status': context.processingStatus || '',
      'Processed At': now,
      'Processing Error': context.processingError || ''
    };
  });
}

function recordAutomationTriggerLog_(automation, fields) {
  const row = buildAutomationTriggerLogRow_(fields);
  insertByHeadersAtTop_(automation.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG), AUTOMATION.HEADERS.TRIGGER_LOG, row);
  return row['Trigger Log ID'];
}

function queueAutomationTriggerLog_(context, fields) {
  const row = buildAutomationTriggerLogRow_(fields, context.now);
  context.triggerLogs.push(row);
  return row['Trigger Log ID'];
}

function buildAutomationTriggerLogRow_(fields, timestamp) {
  return Object.assign({
    'Trigger Log ID': Utilities.getUuid(),
    'Created At': timestamp || automationNowIso_()
  }, fields);
}
