const HUB = {
  SHEETS: {
    QUEUE: 'Queue',
    REVIEW: 'Review',
    FLOW_CONSOLE: 'Flow_Console',
    FLOW_STATE: 'Flow_State',
    HISTORY: 'History',
    RUN_LOG: 'Run_Log',
    RUN_LOG_RAW: 'Run_Log_Raw',
    SKILL_RUN_LOG: 'Skill_Run_Log',
    GRAPH_ENTITIES: 'Graph_Entities',
    GRAPH_W_NODES: 'Graph_W_Nodes',
    GRAPH_EDGES: 'Graph_Edges',
    GRAPH_EVENTS: 'Graph_Events',
  },
  STATUS: {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    SENT: 'Sent',
    LOGGED: 'Logged',
    ERROR: 'Error',
    DISCARDED: 'Discarded',
    SCHEDULED: 'Scheduled'
  },
  REVIEW_DECISION: {
    APPROVE: 'Approve',
    DISCARD: 'Discard'
  },
  FLOW_ACTION: {
    CONTINUE: 'Continue expected path',
    DELAY: 'Report delay',
    EVALUATE_ROLLBACK: 'Evaluate rollback',
    ROLLBACK_DECISION: 'Record rollback decision',
    ROLLBACK: 'Report rollback',
    POSTMORTEM: 'Request postmortem'
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
      'Event Key',
      'Status',
      'Priority',
      'Owner',
      'Channel Override',
      'Slack Thread ID',
      'Send Rule',
      'Payload JSON',
      'Reviewer',
      'Approver',
      'Approved At',
      'Sent At',
      'Slack Channel',
      'Slack Message TS',
      'Slack Message URL',
      'Error',
      'Parent Queue ID',
      'Expected Previous Event Key',
      'Path Override',
      'Scheduled For'
    ],
    HISTORY: [
      'Queue ID',
      'Flow ID',
      'Dedupe Key',
      'Created At',
      'Updated At',
      'Source',
      'Lane',
      'Event Key',
      'Status',
      'Priority',
      'Owner',
      'Channel Override',
      'Slack Thread ID',
      'Send Rule',
      'Payload JSON',
      'Reviewer',
      'Approver',
      'Approved At',
      'Sent At',
      'Slack Channel',
      'Slack Message TS',
      'Slack Message URL',
      'Error',
      'Parent Queue ID',
      'Expected Previous Event Key',
      'Path Override',
      'Scheduled For'
    ],
    FLOW_STATE: [
      'Flow ID',
      'Flow Type',
      'Subject',
      'Owner',
      'Current Event Key',
      'Current Path',
      'Next Happy Event Key',
      'Allowed Sad Path Event Keys',
      'Return Event Key',
      'Slack Channel',
      'Anchor Message TS',
      'Thread TS',
      'Latest Reply TS',
      'Anchor Message URL',
      'Last Queue ID',
      'Last Sent At',
      'Flow Status',
      'Payload JSON',
      'Updated At'
    ],
    REVIEW: [
      'Decision',
      'Queue ID',
      'Created At',
      'Source',
      'Lane',
      'Event Key',
      'Priority',
      'Owner',
      'Status',
      'Subject',
      'What',
      'So What',
      "What's Next",
      'Error',
      'Slack Message URL'
    ],
    FLOW_CONSOLE: [
      'Field',
      'Value',
      'Help'
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
    SKILL_RUN_LOG: [
      'Run ID',
      'Timestamp',
      'Skill ID',
      'Parent Run ID',
      'Status',
      'Input Hash',
      'Output Summary',
      'Error',
      'Duration Ms'
    ],
    GRAPH_ENTITIES: [
      'Entity ID',
      'Flow ID',
      'Entity Type',
      'Subject',
      'Owner',
      'Current Event Key',
      'Current Path',
      'Current Status',
      'Slack Channel',
      'Anchor Message TS',
      'Thread TS',
      'Latest Reply TS',
      'Anchor Message URL',
      'Latest Queue ID',
      'Last Confirmed Update At',
      'Payload JSON',
      'Updated At'
    ],
    GRAPH_W_NODES: [
      'W Node ID',
      'Entity ID',
      'Flow ID',
      'Dimension',
      'Status',
      'User Actual',
      'AI Guess',
      'Confidence',
      'Rationale',
      'Source Queue ID',
      'Source Event Key',
      'Verified At',
      'Updated At'
    ],
    GRAPH_EDGES: [
      'Edge ID',
      'Source Node ID',
      'Target Node ID',
      'Relationship Type',
      'Status',
      'Confidence',
      'Source Queue ID',
      'Source Event Key',
      'Created At',
      'Updated At'
    ],
    GRAPH_EVENTS: [
      'Graph Event ID',
      'Entity ID',
      'Flow ID',
      'Queue ID',
      'Event Key',
      'Graph Action',
      'Status',
      'Payload Hash',
      'Observation JSON',
      'Created At'
    ]
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

function parseJsonObject_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (error) {
    return {};
  }
}

function stringifyJson_(value) {
  return JSON.stringify(value || {});
}
