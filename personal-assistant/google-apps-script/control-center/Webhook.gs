function doPost(e) {
  const params = parsePost_(e);
  if (!params.command) {
    if (params.type === 'url_verification' && params.challenge) {
      return ContentService
        .createTextOutput(params.challenge)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    recordSlackRawPayload_(params, e);
    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  if (!verifySlackToken_(params)) {
    return ContentService
      .createTextOutput('Unauthorized request.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const command = String(params.command || '').toLowerCase();

  if (command === '/release') {
    return handleReleaseCommand_(params);
  }

  return handleIncidentCommand_(params);
}

function handleIncidentCommand_(params) {
  const text = params.text || 'Critical incident reported from Slack.';
  const user = params.user_name || params.user_id || 'Slack user';

  const queued = runSkillOrThrow_('queue_communication_draft', {
    draft: {
    Source: 'Slack Slash Command',
    Lane: 'Incident / Bug',
    'Event Key': 'incident.critical.identified',
    Priority: 'Critical',
    Owner: user,
    'Flow ID': 'incident-' + uuid_(),
    'Dedupe Key': 'incident|critical|identified|' + normalizeKey_(text),
    'Payload JSON': stringifyJson_({
      issue_title: text,
      project: text,
      owner: user,
      what: text,
      so_what: 'This has been reported as a critical issue and requires review before leadership communication.',
      whats_next: 'Triage owner should confirm impact, assign investigation owner, and approve communication.'
    }),
    Reviewer: '',
    Approver: ''
    }
  });
  const queueId = queued.queueId;

  return ContentService
    .createTextOutput('Draft communication created in the Hub queue: ' + queueId)
    .setMimeType(ContentService.MimeType.TEXT);
}

function handleReleaseCommand_(params) {
  const text = params.text || 'Production release update.';
  const user = params.user_name || params.user_id || 'Slack user';
  const parsed = parseReleaseCommandText_(text);

  const queued = runSkillOrThrow_('queue_communication_draft', {
    draft: {
    Source: 'Slack Slash Command',
    Lane: 'Production Release',
    Status: HUB.STATUS.DRAFT,
    'Event Key': parsed.eventKey,
    Priority: parsed.priority,
    Owner: user,
    'Flow ID': parsed.flowId,
    'Dedupe Key': parsed.dedupeKey,
    'Payload JSON': stringifyJson_({
      release_name: parsed.releaseName,
      project: parsed.releaseName,
      owner: user,
      what: parsed.what,
      so_what: parsed.soWhat,
      whats_next: parsed.whatsNext
    })
    }
  });
  const queueId = queued.queueId;

  return ContentService
    .createTextOutput('Draft release communication created in the Hub queue: ' + queueId)
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseReleaseCommandText_(text) {
  const lower = String(text || '').toLowerCase();
  let eventKey = 'release.scheduled';
  let priority = 'Medium';

  if (lower.indexOf('rollback') >= 0 || lower.indexOf('rolled back') >= 0) {
    eventKey = 'release.rolled_back';
    priority = 'Critical';
  } else if (lower.indexOf('delay') >= 0 || lower.indexOf('delayed') >= 0) {
    eventKey = 'release.delayed';
    priority = 'High';
  } else if (lower.indexOf('start') >= 0 || lower.indexOf('started') >= 0) {
    eventKey = 'release.started';
  } else if (lower.indexOf('complete') >= 0 || lower.indexOf('completed') >= 0 || lower.indexOf('done') >= 0) {
    eventKey = 'release.completed';
  } else if (lower.indexOf('go') >= 0 || lower.indexOf('no-go') >= 0 || lower.indexOf('nogo') >= 0) {
    eventKey = 'release.go_no_go';
    priority = 'High';
  }

  return {
    eventKey: eventKey,
    priority: priority,
    releaseName: text,
    flowId: 'release-' + normalizeKey_(text),
    dedupeKey: 'release|' + eventKey + '|' + normalizeKey_(text),
    what: text,
    soWhat: 'This production release event may affect deployment timing, stakeholder readiness, support, or monitoring.',
    whatsNext: 'Release Owner should review the draft, confirm impact, and approve the communication.'
  };
}

function normalizeKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePost_(e) {
  if (!e || !e.postData) return {};

  const contentType = e.postData.type || '';
  const contents = e.postData.contents || '';

  if (contentType.indexOf('application/json') >= 0) {
    return JSON.parse(contents);
  }

  return contents.split('&').reduce((obj, pair) => {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts[0] || '');
    const value = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
    obj[key] = value;
    return obj;
  }, {});
}
