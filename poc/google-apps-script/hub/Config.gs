const HUB = {
  SHEETS: {
    QUEUE: 'Queue',
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
    TEMPLATES: [
      'Template Key',
      'Lane',
      'Communication Event',
      'Lifecycle Stage',
      'Scenario',
      'Default Channel Type',
      'Post Mode',
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

