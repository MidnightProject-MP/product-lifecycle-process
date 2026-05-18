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
    EVENT_CATALOG: ['Event Key', 'Lane', 'Path', 'Communication Event', 'Trigger', 'Template Key', 'Channel Type', 'Post Mode', 'Anchor Update Policy', 'Thread Reply Policy', 'Reply Broadcast', 'Send Rule', 'Severity', 'Active'],
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
      { Key: 'DEFAULT_LEADERSHIP_CHANNEL', Value: '', Scope: 'Slack', Description: 'Default Slack channel ID for leadership escalations and postmortems', 'Is Secret': 'FALSE' }
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
      template_('project-status-update', 'Project status update', '*{{subject}}* update\n*What:* {{what}}\n*So what:* {{so_what}}\n*What\'s next:* {{whats_next}}\nOwner: {{owner}}', '*Project update: {{subject}}*\n*Key update:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}'),
      template_('project-risk-update', 'Project risk update', '*{{subject}} status changed*\n*What changed:* {{what}}\n*So what:* {{so_what}}\n*Next:* {{whats_next}}\nOwner: {{owner}}', '*Project status change: {{subject}}*\n*Key update:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}'),
      template_('project-gate-update', 'Project gate update', '*{{subject}} gate update*\n*Gate:* {{gate}}\n*What:* {{what}}\n*So what:* {{so_what}}\n*What\'s next:* {{whats_next}}\nOwner: {{owner}}', '*Gate update: {{subject}}*\n*Gate:* {{gate}}\n*Key update:* {{what}}\n*Next:* {{whats_next}}'),
      template_('project-escalation', 'Project escalation', '*{{subject}} needs attention*\n*What happened:* {{what}}\n*So what:* {{so_what}}\n*Recovery / next decision:* {{whats_next}}\nOwner: {{owner}}', '*Project exception: {{subject}}*\n*What happened:* {{what}}\n*Impact:* {{so_what}}\n*Next decision:* {{whats_next}}'),
      template_('critical-bug-leadership', 'Critical bug leadership update', '*Critical issue: {{subject}}*\n*What we know:* {{what}}\n*So what:* {{so_what}}\n*Next update / action:* {{whats_next}}\nOwner: {{owner}}', '*Critical issue update: {{subject}}*\n*Key update:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}'),
      template_('release-scheduled', 'Release scheduled', '*[{{subject}}] Release scheduled*\n*Plan:* {{what}}\n*Impact:* {{so_what}}\n*Next decision:* {{whats_next}}\n*Owner:* {{owner}}', '*Release scheduled: {{subject}}*\n*Plan:* {{what}}\n*Impact:* {{so_what}}\n*Next decision:* {{whats_next}}'),
      template_('release-go-no-go', 'Release go/no-go', '*[{{subject}}] Go / no-go approaching*\n*Readiness:* {{what}}\n*Impact:* {{so_what}}\n*Decision needed:* {{whats_next}}\n*Owner:* {{owner}}', '*Go / no-go approaching: {{subject}}*\n*Readiness:* {{what}}\n*Impact:* {{so_what}}\n*Decision needed:* {{whats_next}}'),
      template_('release-started', 'Release started', '*[{{subject}}] Release in progress*\n*Status:* {{what}}\n*Impact:* {{so_what}}\n*Next checkpoint:* {{whats_next}}\n*Owner:* {{owner}}', '*Release started: {{subject}}*\n*Status:* {{what}}\n*Impact:* {{so_what}}\n*Next checkpoint:* {{whats_next}}'),
      template_('release-completed', 'Release completed', '*[{{subject}}] Release completed*\n*Result:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}\n*Owner:* {{owner}}', '*Release completed: {{subject}}*\n*Result:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}'),
      template_('release-delayed', 'Release delayed', '*[{{subject}}] Release delayed*\n*What changed:* {{what}}\n*Impact:* {{so_what}}\n*Revised plan:* {{whats_next}}\n*Owner:* {{owner}}', '*Release delayed: {{subject}}*\n*What changed:* {{what}}\n*Impact:* {{so_what}}\n*Revised plan:* {{whats_next}}'),
      template_('release-rollback-evaluating', 'Rollback being evaluated', '*[{{subject}}] Rollback being evaluated*\n*Why we are evaluating:* {{what}}\n*Current impact:* {{so_what}}\n*Decision ETA / next step:* {{whats_next}}\n*Owner:* {{owner}}', '*Rollback being evaluated: {{subject}}*\n*Reason:* {{what}}\n*Current impact:* {{so_what}}\n*Decision ETA / next step:* {{whats_next}}'),
      template_('release-rollback-decision', 'Rollback decision made', '*[{{subject}}] Rollback decision made*\n*Decision:* {{what}}\n*Impact:* {{so_what}}\n*Next execution step:* {{whats_next}}\n*Owner:* {{owner}}', '*Rollback decision made: {{subject}}*\n*Decision:* {{what}}\n*Impact:* {{so_what}}\n*Next execution step:* {{whats_next}}'),
      template_('release-rolled-back', 'Release rolled back', '*[{{subject}}] Release rolled back*\n*Rollback status:* {{what}}\n*Production impact:* {{so_what}}\n*Recovery / follow-up:* {{whats_next}}\n*Owner:* {{owner}}', '*Release rolled back: {{subject}}*\n*Rollback status:* {{what}}\n*Production impact:* {{so_what}}\n*Recovery / follow-up:* {{whats_next}}'),
      template_('release-postmortem-needed', 'Postmortem required', '*[{{subject}}] Postmortem required*\n*Trigger:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}\n*Owner:* {{owner}}', '*Postmortem required: {{subject}}*\n*Trigger:* {{what}}\n*Impact:* {{so_what}}\n*Next:* {{whats_next}}'),
      template_('stray-story-disposition', 'Stray story disposition', '*Stray story update: {{subject}}*\n*Disposition:* {{destination}}\n*Reason:* {{reason}}\n*What\'s next:* {{whats_next}}\nOwner: {{owner}}', '*Stray story update: {{subject}}*\n*Disposition:* {{destination}}\n*Reason:* {{reason}}\n*Next:* {{whats_next}}')
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
