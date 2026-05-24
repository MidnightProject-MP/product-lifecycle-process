function buildAutomationExportState_(row) {
  const ignored = {
    'Updated At': true,
    Active: true,
    'Manual Review': true,
    'Channel Override': true,
    'Slack Thread ID': true
  };

  return getAutomationStateHeadersForRow_(row).reduce((obj, header) => {
    if (ignored[header]) return obj;
    obj[header] = stringifyAutomationValue_(row[header]);
    return obj;
  }, {});
}

function getAutomationStateHeadersForRow_(row) {
  const headers = AUTOMATION.HEADERS.EXPORT.slice();
  getAutomationOptionalExportHeaders_().forEach(header => {
    if (Object.prototype.hasOwnProperty.call(row, header)) headers.push(header);
  });
  return headers;
}

function diffAutomationStates_(oldState, newState) {
  const keys = {};
  Object.keys(oldState || {}).forEach(key => { keys[key] = true; });
  Object.keys(newState || {}).forEach(key => { keys[key] = true; });

  return Object.keys(keys).sort().filter(key =>
    stringifyAutomationValue_(oldState[key]) !== stringifyAutomationValue_(newState[key])
  ).map(key => ({
    field: key,
    oldValue: stringifyAutomationValue_(oldState[key]),
    newValue: stringifyAutomationValue_(newState[key])
  }));
}

function inferAutomationExportTrigger_(row, oldState, changes) {
  const recordType = normalizeAutomationRecordType_(row['Record Type']);
  if (!changes.length) return { candidate: '', eventKey: '' };

  if (recordType === 'Project') {
    return inferProjectExportTrigger_(row, oldState, changes);
  }

  if (recordType === 'Release') {
    return inferReleaseExportTrigger_(row, oldState, changes);
  }

  return { candidate: 'Changed', eventKey: '' };
}

function inferProjectExportTrigger_(row, oldState, changes) {
  const fields = changes.map(change => change.field);
  const status = normalizeStatus_(row.Status);
  const oldStatus = normalizeStatus_(oldState.Status);

  const specialReleaseTrigger = inferProjectSpecialReleaseTrigger_(row, fields);
  if (specialReleaseTrigger) return specialReleaseTrigger;

  if (isProjectGateCleared_(row, oldState, fields)) {
    if (isProjectPrimaryTargetCleared_(row, oldState)) {
      return { candidate: 'Project primary target cleared', eventKey: 'project.completed' };
    }
    return { candidate: 'Project gate cleared', eventKey: 'project.gate_passed' };
  }

  if (isProjectStatusCommunication_(oldStatus, status, fields)) {
    return {
      candidate: status === 'GREEN' ? 'Project back on track' : 'Material project status change',
      eventKey: 'project.unexpected_status_change'
    };
  }

  if (fields.indexOf('Next Gate ETA') >= 0) {
    return { candidate: 'Project next gate ETA changed', eventKey: 'project.unexpected_status_change' };
  }

  if (fields.indexOf('Primary Target') >= 0) {
    return { candidate: 'Project primary target changed', eventKey: 'project.unexpected_status_change' };
  }

  return { candidate: 'Project changed', eventKey: '' };
}

function inferProjectSpecialReleaseTrigger_(row, fields) {
  if (!isProjectSpecialReleaseGate_(row)) return null;

  if (!stringifyAutomationValue_(row['Next Gate ETA'])) {
    return { candidate: 'Special release missing schedule', eventKey: '' };
  }

  const signalFields = {
    'Next Gate': true,
    'Next Gate ETA': true,
    Status: true,
    'Primary Risk': true
  };
  const hasSignalChange = fields.some(field => signalFields[field]);
  if (!hasSignalChange) return { candidate: 'Special release tracked', eventKey: '' };

  return { candidate: 'Special release scheduled', eventKey: 'release.scheduled' };
}

function isProjectSpecialReleaseGate_(row) {
  return automationTextMatches_(row['Next Gate'], 'Special Release');
}

function isProjectStatusCommunication_(oldStatus, newStatus, fields) {
  if (fields.indexOf('Status') < 0 || oldStatus === newStatus) return false;
  if (['YELLOW', 'RED'].indexOf(newStatus) >= 0) return true;
  return newStatus === 'GREEN' && ['YELLOW', 'RED'].indexOf(oldStatus) >= 0;
}

function isProjectGateCleared_(row, oldState, fields) {
  if (fields.indexOf('Phase') < 0 || fields.indexOf('Next Gate') < 0 || fields.indexOf('Next Gate ETA') < 0) {
    return false;
  }

  const oldEta = parseAutomationDate_(oldState['Next Gate ETA']);
  const newEta = parseAutomationDate_(row['Next Gate ETA']);
  if (!oldEta || !newEta || newEta.getTime() <= oldEta.getTime()) return false;

  return stringifyAutomationValue_(oldState.Phase) !== stringifyAutomationValue_(row.Phase) &&
    stringifyAutomationValue_(oldState['Next Gate']) !== stringifyAutomationValue_(row['Next Gate']);
}

function isProjectPrimaryTargetCleared_(row, oldState) {
  const primaryTarget = stringifyAutomationValue_(row['Primary Target'] || oldState['Primary Target']);
  if (!primaryTarget) return false;

  const oldGate = stringifyAutomationValue_(oldState['Next Gate']);
  const oldPhase = stringifyAutomationValue_(oldState.Phase);
  return automationTextMatches_(oldGate, primaryTarget) || automationTextMatches_(oldPhase, primaryTarget);
}

function inferReleaseExportTrigger_(row, oldState, changes) {
  const fields = changes.map(change => change.field);
  const rollbackStatus = String(row['Rollback Status'] || '').trim().toLowerCase();
  const goNoGo = String(row['Go / No-Go Required'] || '').trim().toLowerCase();
  const releaseStatus = String(row['Release Status'] || row.Status || row.Phase || '').trim();

  if (fields.indexOf('Rollback Status') >= 0 && rollbackStatus && rollbackStatus !== 'none' && rollbackStatus !== 'no') {
    return { candidate: 'Release rollback state changed', eventKey: 'release.rolled_back' };
  }

  if (fields.indexOf('Go / No-Go Required') >= 0 && ['yes', 'true', 'required'].indexOf(goNoGo) >= 0) {
    return { candidate: 'Release go / no-go required', eventKey: 'release.go_no_go' };
  }

  if (fields.indexOf('Release Status') >= 0 || fields.indexOf('Status') >= 0 || fields.indexOf('Phase') >= 0) {
    const eventKey = inferReleaseEventKey_(releaseStatus, row.Notes);
    if (eventKey) return { candidate: 'Release lifecycle state changed', eventKey: eventKey };
  }

  if (fields.indexOf('Release Date') >= 0 && row['Release Date']) {
    return { candidate: 'Release schedule changed', eventKey: 'release.scheduled' };
  }

  return { candidate: 'Release changed', eventKey: '' };
}
