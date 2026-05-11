function doPost(e) {
  const params = parsePost_(e);
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

