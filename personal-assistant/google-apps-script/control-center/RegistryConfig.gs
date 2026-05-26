const REGISTRY = {
  SHEETS: {
    SETTINGS: 'Settings',
    EVENT_CATALOG: 'Event_Catalog',
    TEMPLATES: 'Templates',
    TEMPLATE_VARIABLES: 'Template_Variables',
    EVENT_TRANSITIONS: 'Event_Transitions',
    APPROVAL_RULES: 'Approval_Rules'
  },
  HEADERS: {
    SETTINGS: ['Key', 'Value', 'Scope', 'Description', 'Is Secret'],
    EVENT_CATALOG: ['Event Key', 'Lane', 'Path', 'Communication Event', 'Trigger', 'Template Key', 'Channel Type', 'Post Mode', 'Anchor Update Policy', 'Thread Reply Policy', 'Reply Broadcast', 'Spotlight Policy', 'Send Rule', 'Severity', 'Active'],
    TEMPLATES: ['Template Key', 'Version', 'Template Name', 'Active', 'Anchor Text', 'Reply Text'],
    TEMPLATE_VARIABLES: ['Variable Key', 'Label', 'Required', 'Source', 'Description', 'Example', 'Active'],
    EVENT_TRANSITIONS: ['Event Key', 'Next Happy Event Key', 'Allowed Sad Path Event Keys', 'Return Event Key', 'Flow Terminal', 'Auto Queue Next', 'Default Delay Minutes', 'Active'],
    APPROVAL_RULES: ['Event Key', 'Approver Role', 'Notes', 'Active']
  },
  SEED: {
    SETTINGS: [
      { Key: 'ACTIVE_ENVIRONMENT', Value: 'Personal Assistant', Scope: 'Global', Description: 'Environment label used in logs and reviews', 'Is Secret': 'FALSE' },
      { Key: 'ENABLE_AUTO_SEND', Value: 'FALSE', Scope: 'Hub', Description: 'Reserved control for future auto-send rules', 'Is Secret': 'FALSE' },
      { Key: 'DEFAULT_REVIEW_MODE', Value: 'Review then send', Scope: 'Hub', Description: 'Default review posture when an event does not specify a stricter rule', 'Is Secret': 'FALSE' },
      { Key: 'DEFAULT_PROJECT_CHANNEL', Value: '', Scope: 'Slack', Description: 'Default Slack channel ID for project communications', 'Is Secret': 'FALSE' },
      { Key: 'DEFAULT_INCIDENT_CHANNEL', Value: '', Scope: 'Slack', Description: 'Default Slack channel ID for incident and critical bug communications', 'Is Secret': 'FALSE' },
      { Key: 'DEFAULT_RELEASE_CHANNEL', Value: '', Scope: 'Slack', Description: 'Default Slack channel ID for production release communications', 'Is Secret': 'FALSE' },
      { Key: 'DEFAULT_STRAY_STORY_CHANNEL', Value: '', Scope: 'Slack', Description: 'Default Slack channel ID for stray story intake and prioritization communications', 'Is Secret': 'FALSE' },
      { Key: 'DEFAULT_LEADERSHIP_CHANNEL', Value: '', Scope: 'Slack', Description: 'Default Slack channel ID for leadership escalations and postmortems', 'Is Secret': 'FALSE' },
      { Key: 'TEST_PROJECT_CHANNEL', Value: '', Scope: 'Slack', Description: 'Optional test Slack channel ID for project communications. Falls back to DEFAULT_PROJECT_CHANNEL.', 'Is Secret': 'FALSE' },
      { Key: 'TEST_INCIDENT_CHANNEL', Value: '', Scope: 'Slack', Description: 'Optional test Slack channel ID for incident and critical bug communications. Falls back to DEFAULT_INCIDENT_CHANNEL.', 'Is Secret': 'FALSE' },
      { Key: 'TEST_RELEASE_CHANNEL', Value: '', Scope: 'Slack', Description: 'Optional test Slack channel ID for production release communications. Falls back to DEFAULT_RELEASE_CHANNEL.', 'Is Secret': 'FALSE' },
      { Key: 'TEST_STRAY_STORY_CHANNEL', Value: '', Scope: 'Slack', Description: 'Optional test Slack channel ID for stray story intake and prioritization communications. Falls back to DEFAULT_STRAY_STORY_CHANNEL.', 'Is Secret': 'FALSE' },
      { Key: 'TEST_LEADERSHIP_CHANNEL', Value: '', Scope: 'Slack', Description: 'Optional test Slack channel ID for leadership escalations and postmortems. Falls back to DEFAULT_LEADERSHIP_CHANNEL.', 'Is Secret': 'FALSE' }
    ],
    EVENT_CATALOG: [
      event_('project.kickoff', 'Project', 'Start', 'Project kickoff', 'Project enters managed lifecycle and has owner, scope intent, and first gate.', 'project-status-update', 'Project', 'New Thread', 'Create Anchor Only', 'Always Reply', 'FALSE', 'Review then send', 'Medium'),
      event_('project.weekly_digest', 'Project', 'Heartbeat', 'Weekly project digest item', 'Project is active during weekly digest cycle.', 'project-status-update', 'Project', 'New Thread', 'Create Anchor Only', 'Always Reply', 'FALSE', 'Review then send', 'Medium'),
      event_('project.gate_approaching', 'Project', 'Happy Path', 'Gate approaching', 'Next gate is inside lead time and requires readiness attention.', 'project-gate-update', 'Project', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Review then send', 'Medium'),
      event_('project.gate_passed', 'Project', 'Happy Path', 'Gate passed', 'Gate is approved or completed.', 'project-status-update', 'Project', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Bundle into weekly digest unless material', 'Low'),
      event_('project.completed', 'Project', 'Happy Path', 'Project completed', 'Project reaches completion or lifecycle closure.', 'project-status-update', 'Project', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Review then send', 'Medium'),
      event_('project.unexpected_status_change', 'Project', 'Sad Path', 'Unexpected status change', 'Status, confidence, risk, scope, user exposure, or stakeholder expectations change materially.', 'project-risk-update', 'Project', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Review then send', 'High'),
      event_('project.timeline_updated', 'Project', 'Sad Path', 'Timeline updated', 'Next gate, release, rollout, or committed milestone timing changes materially.', 'project-risk-update', 'Project', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Review then send if material; otherwise digest', 'High'),
      event_('project.gate_exception', 'Project', 'Sad Path', 'Gate missed / failed / delayed', 'Gate misses timing, fails readiness, or receives no-go / conditional decision.', 'project-escalation', 'Project', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'TRUE', 'Approval required', 'High'),
      event_('incident.critical.identified', 'Incident / Bug', 'Start', 'Critical bug identified', 'New bug is critical or existing bug escalates to critical.', 'critical-bug-leadership', 'Incident', 'New Thread', 'Create And Update Anchor', 'Always Reply', 'FALSE', 'Approval required', 'Critical'),
      event_('incident.critical.investigating', 'Incident / Bug', 'Happy Path', 'Investigating', 'Critical bug investigation is active and owner is assigned.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Critical'),
      event_('incident.critical.fix_in_progress', 'Incident / Bug', 'Happy Path', 'Fix in progress', 'Fix owner is assigned and remediation is underway.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Critical'),
      event_('incident.critical.fix_in_qa', 'Incident / Bug', 'Happy Path', 'Fix in QA', 'Fix is ready for validation or actively being validated.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Critical'),
      event_('incident.critical.ready_for_release', 'Incident / Bug', 'Happy Path', 'Fix ready for release', 'Fix passed validation and is ready to enter release flow.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Critical'),
      event_('incident.critical.regressed', 'Incident / Bug', 'Sad Path', 'Critical bug state regressed', 'Bug moves backward in its resolution path.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Critical'),
      event_('incident.critical.delayed', 'Incident / Bug', 'Sad Path', 'Critical bug delayed', 'Expected fix, QA, or release-readiness timing slips materially.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Critical'),
      event_('incident.critical.fix_failed', 'Incident / Bug', 'Sad Path', 'Fix failed', 'Attempted fix fails or introduces unacceptable risk.', 'critical-bug-leadership', 'Incident', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Approval required', 'Critical'),
      event_('stray.submitted', 'Stray Story', 'Start', 'Stray story submitted', 'Story enters intake outside project, bug, or release flow.', 'stray-story-disposition', 'Stray Story', 'New Thread', 'Create Anchor Only', 'Always Reply', 'FALSE', 'Log only', 'Low'),
      event_('stray.weekly_summary', 'Stray Story', 'Heartbeat', 'Weekly prioritization summary', 'Weekly prioritization meeting completes.', 'stray-story-disposition', 'Stray Story', 'New Thread', 'Create Anchor Only', 'Always Reply', 'FALSE', 'Review then send', 'Low'),
      event_('stray.disposition_changed', 'Stray Story', 'Outcome', 'Disposition changed', 'Story disposition changes after intake review.', 'stray-story-disposition', 'Stray Story', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Auto-send eligible', 'Low'),
      event_('stray.exited_intake', 'Stray Story', 'End / Transition', 'Stray story exited intake', 'Story leaves stray-story intake for any destination.', 'stray-story-disposition', 'Stray Story', 'Reply In Thread', 'Keep Anchor', 'Always Reply', 'FALSE', 'Send or log based on destination and impact', 'Low'),
      event_('release.scheduled', 'Production Release', 'Start', 'Release scheduled', 'Release receives a planned production schedule.', 'release-scheduled', 'Release', 'New Thread', 'Create And Update Anchor', 'Always Reply', 'FALSE', 'Review then send', 'Medium'),
      event_('release.go_no_go', 'Production Release', 'Happy Path', 'Go / no-go approaching', 'Release decision window opens.', 'release-go-no-go', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Approval required', 'High'),
      event_('release.started', 'Production Release', 'Happy Path', 'Release started', 'Production release begins.', 'release-started', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Auto-send eligible', 'Medium'),
      event_('release.completed', 'Production Release', 'Happy Path', 'Release completed', 'Production release completes successfully.', 'release-completed', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'Medium'),
      event_('release.delayed', 'Production Release', 'Sad Path', 'Release delayed', 'Release schedule, decision, or execution timing changes materially.', 'release-delayed', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Approval required', 'High'),
      event_('release.rollback_evaluating', 'Production Release', 'Sad Path', 'Rollback being evaluated', 'A production concern may require rollback; decision is not final yet.', 'release-rollback-evaluating', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Approval required', 'Critical'),
      event_('release.rollback_decision', 'Production Release', 'Sad Path', 'Rollback decision made', 'Release owner confirms whether to continue, pause, delay, or roll back.', 'release-rollback-decision', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Approval required', 'Critical'),
      event_('release.rolled_back', 'Production Release', 'Sad Path', 'Release rolled back', 'Release is fully or partially rolled back.', 'release-rolled-back', 'Release', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Approval required', 'Critical'),
      event_('release.postmortem_needed', 'Production Release', 'Sad Path', 'Postmortem required', 'Rollback, critical bug, failed release decision, or material issue requires root-cause review.', 'release-postmortem-needed', 'Leadership', 'Reply In Thread', 'Create And Update Anchor', 'Always Reply', 'TRUE', 'Review then send', 'High')
    ],
    TEMPLATES: [
      template_('project-status-update', 'Project status update scaffold', '*[{{subject}}] Add concise project status headline*\n*Current status:* Add the decision-ready update. Source note: {{what}}\n*Why it matters:* Add stakeholder impact, scope, or expectation change. Source note: {{so_what}}\n*Next step:* Add owner, date, and next checkpoint. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Project update: {{subject}}*'),
      template_('project-risk-update', 'Project risk update scaffold', '*[{{subject}}] Add project risk/status headline*\n*What changed:* State the exact change, old/new value if relevant, and reason. Source note: {{what}}\n*Why it matters:* Add stakeholder impact and confidence/risk implications. Source note: {{so_what}}\n*Next step:* Add recovery path, owner, and timing. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Project risk/status update: {{subject}}*'),
      template_('project-gate-update', 'Project gate update scaffold', '*[{{subject}}] Add gate update headline*\n*Gate:* {{gate}}\n*What changed:* Add gate status, decision, or readiness detail. Source note: {{what}}\n*Why it matters:* Add stakeholder impact. Source note: {{so_what}}\n*Next step:* Add owner, date, and checkpoint. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Gate update: {{subject}}*'),
      template_('project-escalation', 'Project escalation scaffold', '*[{{subject}}] Add escalation headline*\n*What happened:* Add the blocker, miss, or exception. Source note: {{what}}\n*Why it matters:* Add business/stakeholder impact. Source note: {{so_what}}\n*Recovery / decision:* Add decision owner, date, and recovery path. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Project escalation: {{subject}}*'),
      template_('critical-bug-leadership', 'Critical bug leadership scaffold', '*[{{subject}}] Add critical issue headline*\n*What we know:* Add confirmed facts and current state. Source note: {{what}}\n*Why it matters:* Add customer, operational, or leadership impact. Source note: {{so_what}}\n*Next update / action:* Add owner, ETA, and next decision. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Critical issue update: {{subject}}*'),
      template_('release-scheduled', 'Release scheduled scaffold', '*[{{subject}}] Add release schedule headline*\n*Schedule / scope:* Add date, scope, release type, and readiness notes. Source note: {{what}}\n*Why it matters:* Add stakeholder impact and support expectations. Source note: {{so_what}}\n*Next checkpoint:* Add go/no-go owner, timing, and required decision. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Release scheduled: {{subject}}*'),
      template_('release-go-no-go', 'Release go/no-go scaffold', '*[{{subject}}] Add go/no-go headline*\n*Readiness:* Add current readiness, open risks, and decision context. Source note: {{what}}\n*Why it matters:* Add stakeholder impact and operating expectation. Source note: {{so_what}}\n*Decision path:* Add owner, decision time, and next update. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Go / no-go: {{subject}}*'),
      template_('release-started', 'Release started scaffold', '*[{{subject}}] Add release execution headline*\n*Execution status:* Add what started, scope, and current confidence. Source note: {{what}}\n*Why it matters:* Add expected stakeholder impact during the window. Source note: {{so_what}}\n*Next checkpoint:* Add timing and next confirmation. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Release started: {{subject}}*'),
      template_('release-completed', 'Release completed scaffold', '*[{{subject}}] Add release completion headline*\n*Result:* Add completion state, scope, and known exceptions. Source note: {{what}}\n*Why it matters:* Add production/customer impact and readiness for normal operation. Source note: {{so_what}}\n*Next step:* Add follow-up, monitoring, or post-release owner. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Release completed: {{subject}}*'),
      template_('release-delayed', 'Release delayed scaffold', '*[{{subject}}] Add release delay headline*\n*What changed:* Add original plan, revised plan, and reason. Source note: {{what}}\n*Why it matters:* Add stakeholder impact and support expectations. Source note: {{so_what}}\n*Revised path:* Add new timing, owner, and next decision/update. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Release delayed: {{subject}}*'),
      template_('release-rollback-evaluating', 'Rollback being evaluated scaffold', '*[{{subject}}] Add rollback-evaluation headline*\n*Concern:* Add issue, severity, and decision criteria. Source note: {{what}}\n*Why it matters:* Add production/customer impact and interim expectation. Source note: {{so_what}}\n*Decision ETA / next step:* Add owner and decision time. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Rollback being evaluated: {{subject}}*'),
      template_('release-rollback-decision', 'Rollback decision scaffold', '*[{{subject}}] Add rollback decision headline*\n*Decision:* Add continue/pause/delay/rollback decision and reason. Source note: {{what}}\n*Why it matters:* Add stakeholder impact and operational expectation. Source note: {{so_what}}\n*Execution path:* Add owner, timing, and next update. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Rollback decision: {{subject}}*'),
      template_('release-rolled-back', 'Release rolled back scaffold', '*[{{subject}}] Add rollback completion headline*\n*Rollback status:* Add what was rolled back, production state, and remaining risk. Source note: {{what}}\n*Why it matters:* Add stakeholder/customer impact. Source note: {{so_what}}\n*Recovery path:* Add next recovery/postmortem step, owner, and timing. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Release rolled back: {{subject}}*'),
      template_('release-postmortem-needed', 'Postmortem required scaffold', '*[{{subject}}] Add postmortem headline*\n*Trigger:* Add why postmortem is required and what event caused it. Source note: {{what}}\n*Why it matters:* Add stakeholder impact and learning objective. Source note: {{so_what}}\n*Follow-up:* Add owner, timing, and expected output. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Postmortem required: {{subject}}*'),
      template_('stray-story-disposition', 'Stray story disposition scaffold', '*[{{subject}}] Add intake/disposition headline*\n*Disposition:* {{destination}}\n*Reason:* Add rationale and context. Source note: {{reason}}\n*Next step:* Add owner and next action. Source note: {{whats_next}}\n*Owner:* {{owner}}', '*Stray story update: {{subject}}*')
    ],
    TEMPLATE_VARIABLES: [
      variable_('subject', 'Subject', 'TRUE', 'Payload', 'Project, release, incident, story, or digest title used in every communication.', 'May production release'),
      variable_('what', 'What', 'TRUE', 'Payload', 'Concise factual update content.', 'Release started.'),
      variable_('so_what', 'So What', 'TRUE', 'Payload', 'Stakeholder meaning, business impact, or expectation change.', 'Stakeholders should expect production change activity.'),
      variable_('whats_next', 'What\'s Next', 'TRUE', 'Payload', 'Next action, owner, timing, or decision.', 'Release owner will confirm completion.'),
      variable_('owner', 'Owner', 'TRUE', 'Payload', 'Communication owner accountable for follow-up.', 'Release Owner'),
      variable_('gate', 'Gate', 'FALSE', 'Payload', 'Gate or decision point when relevant.', 'Go / no-go'),
      variable_('destination', 'Destination', 'FALSE', 'Payload', 'Final workflow destination when relevant.', 'Backlog'),
      variable_('reason', 'Reason', 'FALSE', 'Payload', 'Disposition or decision rationale when relevant.', 'Accepted for prioritization')
    ],
    EVENT_TRANSITIONS: [
      transition_('project.kickoff', 'project.gate_approaching', 'project.unexpected_status_change,project.timeline_updated,project.gate_exception', 'project.gate_approaching', 'FALSE', 'FALSE', 0),
      transition_('project.gate_approaching', 'project.gate_passed', 'project.unexpected_status_change,project.timeline_updated,project.gate_exception', 'project.gate_approaching', 'FALSE', 'FALSE', 0),
      transition_('project.gate_passed', 'project.completed', 'project.unexpected_status_change,project.timeline_updated,project.gate_exception', 'project.gate_approaching', 'FALSE', 'FALSE', 0),
      transition_('project.completed', '', '', '', 'TRUE', 'FALSE', 0),
      transition_('project.unexpected_status_change', 'project.gate_approaching', 'project.timeline_updated,project.gate_exception', 'project.gate_approaching', 'FALSE', 'FALSE', 0),
      transition_('project.timeline_updated', 'project.gate_approaching', 'project.unexpected_status_change,project.gate_exception', 'project.gate_approaching', 'FALSE', 'FALSE', 0),
      transition_('project.gate_exception', 'project.gate_approaching', 'project.unexpected_status_change,project.timeline_updated', 'project.gate_approaching', 'FALSE', 'FALSE', 0),
      transition_('incident.critical.identified', 'incident.critical.investigating', 'incident.critical.delayed,incident.critical.fix_failed', 'incident.critical.investigating', 'FALSE', 'TRUE', 30),
      transition_('incident.critical.investigating', 'incident.critical.fix_in_progress', 'incident.critical.delayed,incident.critical.fix_failed', 'incident.critical.fix_in_progress', 'FALSE', 'TRUE', 30),
      transition_('incident.critical.fix_in_progress', 'incident.critical.fix_in_qa', 'incident.critical.regressed,incident.critical.delayed,incident.critical.fix_failed', 'incident.critical.fix_in_progress', 'FALSE', 'TRUE', 30),
      transition_('incident.critical.fix_in_qa', 'incident.critical.ready_for_release', 'incident.critical.regressed,incident.critical.delayed,incident.critical.fix_failed', 'incident.critical.fix_in_progress', 'FALSE', 'TRUE', 30),
      transition_('incident.critical.ready_for_release', '', 'incident.critical.regressed,incident.critical.delayed', '', 'TRUE', 'FALSE', 0),
      transition_('incident.critical.regressed', 'incident.critical.fix_in_progress', 'incident.critical.delayed,incident.critical.fix_failed', 'incident.critical.fix_in_progress', 'FALSE', 'TRUE', 30),
      transition_('incident.critical.delayed', 'incident.critical.fix_in_progress', 'incident.critical.regressed,incident.critical.fix_failed', 'incident.critical.fix_in_progress', 'FALSE', 'TRUE', 30),
      transition_('incident.critical.fix_failed', 'incident.critical.investigating', 'incident.critical.delayed', 'incident.critical.investigating', 'FALSE', 'TRUE', 30),
      transition_('release.scheduled', 'release.go_no_go', 'release.delayed', 'release.go_no_go', 'FALSE', 'TRUE', 1440),
      transition_('release.go_no_go', 'release.started', 'release.delayed', 'release.go_no_go', 'FALSE', 'TRUE', 60),
      transition_('release.started', 'release.completed', 'release.delayed,release.rollback_evaluating,release.rolled_back', 'release.started', 'FALSE', 'TRUE', 30),
      transition_('release.completed', '', 'release.postmortem_needed', '', 'TRUE', 'FALSE', 0),
      transition_('release.delayed', 'release.go_no_go', 'release.rollback_evaluating,release.rolled_back', 'release.go_no_go', 'FALSE', 'TRUE', 1440),
      transition_('release.rollback_evaluating', 'release.rollback_decision', 'release.delayed,release.rolled_back', 'release.started', 'FALSE', 'TRUE', 30),
      transition_('release.rollback_decision', 'release.completed', 'release.delayed,release.rolled_back', 'release.started', 'FALSE', 'TRUE', 30),
      transition_('release.rolled_back', 'release.postmortem_needed', '', 'release.postmortem_needed', 'FALSE', 'TRUE', 60),
      transition_('release.postmortem_needed', '', '', '', 'TRUE', 'FALSE', 0),
      transition_('stray.submitted', 'stray.weekly_summary', 'stray.disposition_changed,stray.exited_intake', 'stray.weekly_summary', 'FALSE', 'FALSE', 0),
      transition_('stray.weekly_summary', 'stray.disposition_changed', 'stray.exited_intake', 'stray.disposition_changed', 'FALSE', 'FALSE', 0),
      transition_('stray.disposition_changed', 'stray.exited_intake', '', 'stray.exited_intake', 'FALSE', 'FALSE', 0),
      transition_('stray.exited_intake', '', '', '', 'TRUE', 'FALSE', 0)
    ],
    APPROVAL_RULES: [
      { 'Event Key': 'project.gate_exception', 'Approver Role': 'Accountable phase owner', Notes: 'Required for missed, failed, or delayed gates.', Active: 'TRUE' },
      { 'Event Key': 'incident.critical.identified', 'Approver Role': 'Phase owner / accountable leader', Notes: 'Required before leadership broadcast unless emergency protocol applies.', Active: 'TRUE' },
      { 'Event Key': 'incident.critical.fix_failed', 'Approver Role': 'Phase owner / accountable leader', Notes: 'Required because confidence and recovery path changed.', Active: 'TRUE' },
      { 'Event Key': 'release.go_no_go', 'Approver Role': 'Decision owner', Notes: 'Required before production go/no-go communication.', Active: 'TRUE' },
      { 'Event Key': 'release.delayed', 'Approver Role': 'Accountable release decision owner', Notes: 'Required because timeline or support expectations changed.', Active: 'TRUE' },
      { 'Event Key': 'release.rollback_evaluating', 'Approver Role': 'Accountable release decision owner', Notes: 'Required because rollback is being considered and leadership needs a decision ETA.', Active: 'TRUE' },
      { 'Event Key': 'release.rollback_decision', 'Approver Role': 'Accountable release decision owner', Notes: 'Required because rollback decision changes production confidence and stakeholder expectations.', Active: 'TRUE' },
      { 'Event Key': 'release.rolled_back', 'Approver Role': 'Accountable leader', Notes: 'Required for rollback communication.', Active: 'TRUE' }
    ]
  }
};

function event_(eventKey, lane, path, eventName, trigger, templateKey, channelType, postMode, anchorUpdatePolicy, threadReplyPolicy, replyBroadcast, sendRule, severity) {
  return {
    'Event Key': eventKey,
    Lane: lane,
    Path: path,
    'Communication Event': eventName,
    Trigger: trigger,
    'Template Key': templateKey,
    'Channel Type': channelType,
    'Post Mode': postMode,
    'Anchor Update Policy': anchorUpdatePolicy,
    'Thread Reply Policy': threadReplyPolicy,
    'Reply Broadcast': replyBroadcast,
    'Spotlight Policy': String(replyBroadcast || '').toUpperCase() === 'TRUE' ? 'Keep Latest' : 'None',
    'Send Rule': sendRule,
    Severity: severity,
    Active: 'TRUE'
  };
}

function template_(templateKey, name, anchorText, replyText) {
  return {
    'Template Key': templateKey,
    Version: 1,
    'Template Name': name,
    Active: 'TRUE',
    'Anchor Text': anchorText,
    'Reply Text': replyText,
    Text: anchorText
  };
}

function transition_(eventKey, nextHappyEventKey, allowedSadPathEventKeys, returnEventKey, flowTerminal, autoQueueNext, defaultDelayMinutes) {
  return {
    'Event Key': eventKey,
    'Next Happy Event Key': nextHappyEventKey,
    'Allowed Sad Path Event Keys': allowedSadPathEventKeys,
    'Return Event Key': returnEventKey,
    'Flow Terminal': flowTerminal,
    'Auto Queue Next': autoQueueNext,
    'Default Delay Minutes': defaultDelayMinutes,
    Active: 'TRUE'
  };
}
