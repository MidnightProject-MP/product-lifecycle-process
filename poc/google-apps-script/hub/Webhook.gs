function doPost(e) {
  const params = parsePost_(e);
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

  const queueId = appendQueueDraft_({
    Source: 'Slack Slash Command',
    Lane: 'Incident / Bug',
    'Communication Event': 'Critical bug identified',
    'Lifecycle Stage': 'Investigating',
    Scenario: 'Critical Bug',
    Priority: 'Critical',
    Project: text,
    Owner: user,
    'Template Key': 'critical-bug-identified',
    'Flow ID': 'incident-' + uuid_(),
    'Dedupe Key': 'incident|critical-bug-identified|' + text,
    What: text,
    'So What': 'This has been reported as a critical issue and requires review before leadership communication.',
    "What's Next": 'Triage owner should confirm impact, assign investigation owner, and approve communication.',
    Reviewer: '',
    Approver: ''
  });

  return ContentService
    .createTextOutput('Draft communication created in the Hub queue: ' + queueId)
    .setMimeType(ContentService.MimeType.TEXT);
}

function handleReleaseCommand_(params) {
  const text = params.text || 'Production release update.';
  const user = params.user_name || params.user_id || 'Slack user';
  const parsed = parseReleaseCommandText_(text);

  const queueId = appendQueueDraft_({
    Source: 'Slack Slash Command',
    Lane: 'Production Release',
    'Communication Event': parsed.event,
    'Lifecycle Stage': 'Release',
    Scenario: parsed.scenario,
    Status: HUB.STATUS.DRAFT,
    Priority: parsed.priority,
    Project: parsed.releaseName,
    Owner: user,
    'Template Key': parsed.templateKey,
    'Flow ID': parsed.flowId,
    'Dedupe Key': parsed.dedupeKey,
    What: parsed.what,
    'So What': parsed.soWhat,
    "What's Next": parsed.whatsNext
  });

  return ContentService
    .createTextOutput('Draft release communication created in the Hub queue: ' + queueId)
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseReleaseCommandText_(text) {
  const lower = String(text || '').toLowerCase();
  let event = 'Release scheduled';
  let scenario = 'Release Scheduled';
  let templateKey = 'release-scheduled';
  let priority = 'Medium';

  if (lower.indexOf('rollback') >= 0 || lower.indexOf('rolled back') >= 0) {
    event = 'Release rolled back';
    scenario = 'Release Rollback';
    templateKey = 'release-rolled-back';
    priority = 'Critical';
  } else if (lower.indexOf('delay') >= 0 || lower.indexOf('delayed') >= 0) {
    event = 'Release delayed';
    scenario = 'Release Delay';
    templateKey = 'release-delayed';
    priority = 'High';
  } else if (lower.indexOf('start') >= 0 || lower.indexOf('started') >= 0) {
    event = 'Release started';
    scenario = 'Release Execution';
    templateKey = 'release-execution';
  }

  return {
    event: event,
    scenario: scenario,
    templateKey: templateKey,
    priority: priority,
    releaseName: text,
    flowId: 'release-' + normalizeKey_(text),
    dedupeKey: 'release|' + event + '|' + normalizeKey_(text),
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
