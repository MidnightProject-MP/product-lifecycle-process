const HUB = {
  SHEETS: {
    QUEUE: 'Queue',
    HISTORY: 'History',
    RUN_LOG: 'Run_Log',
    TEMPLATES: 'Templates',
    CONFIG: 'Config'
  },
  STATUS: {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    SENT: 'Sent',
    ERROR: 'Error'
  },
  HEADERS: {
    QUEUE: [
      'Queue ID',
      'Flow ID',
      'Dedupe Key',
      'Created At',
      'Updated At',
      'Source',
      'Lane',
      'Communication Event',
      'Lifecycle Stage',
      'Scenario',
      'Status',
      'Priority',
      'Project',
      'Owner',
      'Channel',
      'Slack Thread ID',
      'Template Key',
      'Send Rule',
      'What',
      'So What',
      "What's Next",
      'Reason',
      'Destination',
      'Reviewer',
      'Approver',
      'Approved At',
      'Sent At',
      'Slack Message URL',
      'Error'
    ],
    HISTORY: [
      'Queue ID',
      'Flow ID',
      'Dedupe Key',
      'Created At',
      'Updated At',
      'Source',
      'Lane',
      'Communication Event',
      'Lifecycle Stage',
      'Scenario',
      'Status',
      'Priority',
      'Project',
      'Owner',
      'Channel',
      'Slack Thread ID',
      'Template Key',
      'Send Rule',
      'What',
      'So What',
      "What's Next",
      'Reason',
      'Destination',
      'Reviewer',
      'Approver',
      'Approved At',
      'Sent At',
      'Slack Message URL',
      'Error'
    ],
    RUN_LOG: [
      'Log ID',
      'Timestamp',
      'Level',
      'Function',
      'Queue ID',
      'Message',
      'Details'
    ],
    TEMPLATES: [
      'Template Key',
      'Lane',
      'Communication Event',
      'Lifecycle Stage',
      'Scenario',
      'Default Channel Type',
      'Post Mode',
      'Default Send Rule',
      'Text'
    ],
    CONFIG: ['Key', 'Value']
  }
};

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function nowIso_() {
  return new Date().toISOString();
}

function uuid_() {
  return Utilities.getUuid();
}

function verifySlackToken_(params) {
  const expected = getScriptProperty_('SLACK_VERIFICATION_TOKEN');
  if (!expected) return true;
  return params && params.token === expected;
}
