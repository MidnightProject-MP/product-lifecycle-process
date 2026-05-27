const TRUST_LAYER = {
  EVENT_STATUS: {
    RAW: 'Raw',
    PENDING: 'Pending',
    PROCESSED: 'Processed',
    SKIPPED: 'Skipped',
    ERROR: 'Error'
  },
  RISK_STATUS: {
    OPEN: 'Open',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed'
  },
  AUDIT_RESULT: {
    NO_CHANGE: 'NO_CHANGE',
    DRIFT: 'DRIFT',
    AMBIGUOUS: 'AMBIGUOUS',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
  },
  DEFAULT_RAW_RETENTION_DAYS: 7,
  DEFAULT_EVIDENCE_BLOCK_LIMIT: 12,
  DEFAULT_EVIDENCE_CHAR_LIMIT: 12000
};

function setupTrustLayerSheets_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = [
    [HUB.SHEETS.UNIFIED_EVENT_LOG, HUB.HEADERS.UNIFIED_EVENT_LOG],
    [HUB.SHEETS.SLACK_INBOX_RAW, HUB.HEADERS.SLACK_INBOX_RAW],
    [HUB.SHEETS.ALIGNMENT_RISKS, HUB.HEADERS.ALIGNMENT_RISKS],
    [HUB.SHEETS.PROJECT_HISTORY, HUB.HEADERS.PROJECT_HISTORY]
  ];
  sheets.forEach(pair => {
    const sheet = ensureSheet_(ss, pair[0], pair[1]);
    sheet.setFrozenRows(1);
    configureHubPlainTextColumns_(sheet);
    try {
      sheet.hideSheet();
    } catch (error) {
      logHub_('WARN', 'setupTrustLayerSheets_', '', 'Skipped hiding trust-layer sheet.', {
        sheet: pair[0],
        error: error.message || String(error)
      });
    }
  });
}

function appendUnifiedEvent(input) {
  return runSkillOrThrow_('append_unified_event', input || {});
}

function handleAppendUnifiedEventSkill_(input) {
  return appendUnifiedEventLocked_(input || {});
}

function appendUnifiedEventLocked_(event) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Could not acquire Unified Event Log lock.');
  }

  try {
    const ss = getControlCenterSpreadsheet_();
    const sheet = ensureSheet_(ss, HUB.SHEETS.UNIFIED_EVENT_LOG, HUB.HEADERS.UNIFIED_EVENT_LOG);
    const normalized = normalizeUnifiedEvent_(event || {});
    const idempotencyKey = buildUnifiedEventIdempotencyKey_(normalized);
    const rows = getObjects_(sheet);
    const duplicate = rows.find(row => buildUnifiedEventIdempotencyKey_(row) === idempotencyKey);
    if (duplicate) {
      return {
        eventId: duplicate['Event ID'],
        duplicate: true,
        idempotencyKey: idempotencyKey
      };
    }

    insertByHeadersAtTop_(sheet, HUB.HEADERS.UNIFIED_EVENT_LOG, normalized);
    return {
      eventId: normalized['Event ID'],
      duplicate: false,
      idempotencyKey: idempotencyKey
    };
  } finally {
    lock.releaseLock();
  }
}

function normalizeUnifiedEvent_(event) {
  const payload = event.payload || parseJsonObject_(event['Payload JSON']) || {};
  const payloadJson = event['Payload JSON'] || stringifyJson_(payload);
  const payloadHash = event['Payload Hash'] || hashString_(payloadJson);
  const now = nowIso_();
  return {
    'Event ID': event['Event ID'] || event.eventId || uuid_(),
    'Created At': event['Created At'] || event.createdAt || now,
    'Event Type': event['Event Type'] || event.eventType || '',
    'Entity Type': event['Entity Type'] || event.entityType || payload.entity_type || '',
    'Entity ID': event['Entity ID'] || event.entityId || payload.entity_id || '',
    'Flow ID': event['Flow ID'] || event.flowId || payload.flow_id || '',
    'Correlation ID': event['Correlation ID'] || event.correlationId || '',
    'Source Type': event['Source Type'] || event.sourceType || payload.source_type || '',
    'Source ID': event['Source ID'] || event.sourceId || payload.source_id || '',
    'Source URL': event['Source URL'] || event.sourceUrl || payload.source_url || '',
    'Source Locator': event['Source Locator'] || event.sourceLocator || payload.source_locator || '',
    'Source Timestamp': event['Source Timestamp'] || event.sourceTimestamp || payload.source_timestamp || '',
    Actor: event.Actor || event.actor || payload.actor || '',
    'Event Status': event['Event Status'] || event.eventStatus || TRUST_LAYER.EVENT_STATUS.PENDING,
    'Payload Hash': payloadHash,
    'Payload JSON': payloadJson,
    'Evidence Quote': event['Evidence Quote'] || event.evidenceQuote || payload.evidence_quote || '',
    'Alignment Risk ID': event['Alignment Risk ID'] || event.alignmentRiskId || '',
    'Parent Event ID': event['Parent Event ID'] || event.parentEventId || '',
    'Rollup Status': event['Rollup Status'] || event.rollupStatus || '',
    'Retention Until': event['Retention Until'] || event.retentionUntil || buildTrustLayerRetentionUntil_(TRUST_LAYER.DEFAULT_RAW_RETENTION_DAYS),
    'Processed At': event['Processed At'] || event.processedAt || '',
    'Processing Error': event['Processing Error'] || event.processingError || ''
  };
}

function buildUnifiedEventIdempotencyKey_(event) {
  if (event['Correlation ID']) return 'correlation|' + event['Correlation ID'];
  return [
    event['Event Type'] || '',
    event['Source Type'] || '',
    event['Source ID'] || '',
    event['Source Locator'] || '',
    event['Payload Hash'] || ''
  ].join('|');
}

function buildTrustLayerRetentionUntil_(days) {
  return new Date(Date.now() + Number(days || 7) * 24 * 60 * 60 * 1000).toISOString();
}

function recordSlackRawPayload_(params, e) {
  const ss = getControlCenterSpreadsheet_();
  const sheet = ensureSheet_(ss, HUB.SHEETS.SLACK_INBOX_RAW, HUB.HEADERS.SLACK_INBOX_RAW);
  const payload = {
    params: params || {},
    contentType: e && e.postData && e.postData.type || '',
    raw: e && e.postData && e.postData.contents || ''
  };
  const row = [
    uuid_(),
    nowIso_(),
    stringifyJson_(payload),
    TRUST_LAYER.EVENT_STATUS.RAW,
    '',
    ''
  ];
  sheet.appendRow(row);
}

function processSlackInboxRaw(maxRows) {
  return runSkillOrThrow_('sensor_slack_scan_delta', {
    maxRows: maxRows || 20
  });
}

function pollMonitoredSlackChannels(maxMessagesPerChannel) {
  return runSkillOrThrow_('sensor_slack_pull_delta', {
    maxMessagesPerChannel: maxMessagesPerChannel || 100
  });
}

function handleSensorSlackPullDeltaSkill_(input) {
  const channels = getMonitoredSlackChannels_();
  const includeBotMessages = isTruthy_(getRegistrySetting_('MONITORED_SLACK_INCLUDE_BOT_MESSAGES'));
  const maxMessages = Number(input.maxMessagesPerChannel || 100);
  let scannedChannels = 0;
  let messagesSeen = 0;
  let eventsCreated = 0;
  let duplicates = 0;
  const errors = [];

  channels.forEach(channel => {
    try {
      const oldestTs = getSlackPullOldestTs_(channel);
      const result = fetchSlackChannelHistory_(channel, oldestTs, maxMessages);
      scannedChannels += 1;
      let maxTs = oldestTs;
      (result.messages || []).slice().reverse().forEach(message => {
        if (!includeBotMessages && isSlackBotMessage_(message)) return;
        messagesSeen += 1;
        const event = normalizePulledSlackMessageToEvent_(channel, message);
        const appendResult = appendUnifiedEventLocked_(event);
        if (appendResult.duplicate) {
          duplicates += 1;
        } else {
          eventsCreated += 1;
        }
        if (message.ts && Number(message.ts) > Number(maxTs || 0)) maxTs = message.ts;
      });
      if (maxTs && String(maxTs) !== String(oldestTs || '')) {
        updateAutomationConfigValue_(getControlCenterSpreadsheet_(), buildSlackPullCursorConfigKey_(channel), String(maxTs));
      }
    } catch (error) {
      errors.push({
        channel: channel,
        error: error.message || String(error)
      });
      logHub_('WARN', 'pollMonitoredSlackChannels', '', 'Failed to pull monitored Slack channel.', {
        channel: channel,
        error: error.message || String(error)
      });
    }
  });

  return {
    scannedChannels: scannedChannels,
    messagesSeen: messagesSeen,
    eventsCreated: eventsCreated,
    duplicates: duplicates,
    errors: errors
  };
}

function getMonitoredSlackChannels_() {
  return parseMonitoredSlackChannels_(getRegistrySetting_('MONITORED_SLACK_CHANNELS'));
}

function parseMonitoredSlackChannels_(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map(channel => channel.trim())
    .filter(channel => /^C|^G/.test(channel))
    .filter((channel, index, list) => list.indexOf(channel) === index);
}

function getSlackPullOldestTs_(channel) {
  const config = getAutomationConfig_();
  const cursor = config[buildSlackPullCursorConfigKey_(channel)];
  if (cursor) return cursor;
  const lookbackMinutes = Number(getRegistrySetting_('MONITORED_SLACK_LOOKBACK_MINUTES') || 60);
  return String(Math.floor((Date.now() - lookbackMinutes * 60 * 1000) / 1000));
}

function buildSlackPullCursorConfigKey_(channel) {
  return 'SLACK_PULL_CURSOR_' + String(channel || '').replace(/[^A-Z0-9]/gi, '_').toUpperCase();
}

function isSlackBotMessage_(message) {
  return Boolean(message && (message.bot_id || message.subtype === 'bot_message'));
}

function normalizePulledSlackMessageToEvent_(channel, message) {
  const sourceId = channel + ':' + (message.ts || uuid_());
  const sourceLocator = channel + ':' + (message.thread_ts || message.ts || '');
  return {
    eventType: 'sensor.slack_message_seen',
    entityType: '',
    entityId: '',
    sourceType: 'slack',
    sourceId: sourceId,
    sourceUrl: '',
    sourceLocator: sourceLocator,
    sourceTimestamp: message.ts || '',
    actor: message.user || message.username || '',
    payload: {
      source_type: 'slack',
      source_id: sourceId,
      source_locator: sourceLocator,
      channel: channel,
      ts: message.ts || '',
      thread_ts: message.thread_ts || '',
      user: message.user || '',
      text: message.text || '',
      subtype: message.subtype || ''
    }
  };
}

function handleSensorSlackScanDeltaSkill_(input) {
  const ss = getControlCenterSpreadsheet_();
  const sheet = ensureSheet_(ss, HUB.SHEETS.SLACK_INBOX_RAW, HUB.HEADERS.SLACK_INBOX_RAW);
  const rows = getObjects_(sheet);
  const limit = Number(input.maxRows || 20);
  let processed = 0;
  let errors = 0;

  rows.some(raw => {
    if (processed >= limit) return true;
    if (String(raw['Processing Status'] || '') !== TRUST_LAYER.EVENT_STATUS.RAW) return false;
    const rowNumber = findTrustLayerRowById_(sheet, 'Raw ID', raw['Raw ID']);
    try {
      const payload = parseJsonObject_(raw['Payload JSON']);
      const normalized = normalizeSlackRawPayloadToEvent_(raw, payload);
      const result = appendUnifiedEventLocked_(normalized);
      if (rowNumber) {
        updateRowFields_(sheet, rowNumber, {
          'Processing Status': result.duplicate ? 'Duplicate' : TRUST_LAYER.EVENT_STATUS.PROCESSED,
          'Processed At': nowIso_(),
          'Processing Error': ''
        });
      }
      processed += 1;
    } catch (error) {
      errors += 1;
      if (rowNumber) {
        updateRowFields_(sheet, rowNumber, {
          'Processing Status': TRUST_LAYER.EVENT_STATUS.ERROR,
          'Processed At': nowIso_(),
          'Processing Error': error.message || String(error)
        });
      }
    }
    return false;
  });

  return {
    processed: processed,
    errors: errors
  };
}

function normalizeSlackRawPayloadToEvent_(rawRow, payload) {
  const params = payload.params || {};
  const event = params.event || {};
  const sourceId = event.client_msg_id || params.event_id || params.trigger_id || rawRow['Raw ID'];
  const sourceLocator = [event.channel || params.channel_id || '', event.thread_ts || event.ts || params.event_time || ''].join(':');
  return {
    eventType: 'sensor.slack_message_seen',
    entityType: '',
    entityId: '',
    sourceType: 'slack',
    sourceId: sourceId,
    sourceUrl: '',
    sourceLocator: sourceLocator,
    sourceTimestamp: event.event_ts || event.ts || params.event_time || rawRow['Received At'],
    actor: event.user || params.user_id || params.user_name || '',
    payload: {
      source_type: 'slack',
      source_id: sourceId,
      source_locator: sourceLocator,
      text: event.text || params.text || '',
      channel: event.channel || params.channel_id || '',
      user: event.user || params.user_id || params.user_name || '',
      raw_id: rawRow['Raw ID']
    }
  };
}

function runEssentialMilestoneAudit(input) {
  return runSkillOrThrow_('run_essential_milestone_audit', input || {});
}

function handleRunEssentialMilestoneAuditSkill_(input) {
  return runEssentialMilestoneAudit_(input || {});
}

function runEssentialMilestoneAudit_(input) {
  const official = input.officialState || input.official || {};
  const rawText = input.documentText || input.rawText || '';
  const evidence = buildEssentialAuditEvidencePacket_(rawText, official, input.options || {});
  const entityId = input.entityId || official.entity_id || official.flow_id || '';
  const milestoneId = input.milestoneId || official.milestone_id || official.name || '';

  if (!evidence.blocks.length) {
    return recordEssentialAuditResult_(input, {
      audit_type: 'milestone_date',
      entity_id: entityId,
      milestone_id: milestoneId,
      result: TRUST_LAYER.AUDIT_RESULT.INSUFFICIENT_EVIDENCE,
      expected_value: official.expected_value || official.target_date || official.date || '',
      observed_value: '',
      evidence_quote: '',
      evidence_locator: '',
      confidence: 0,
      needs_human_review: true,
      notes: 'No candidate source text matched the milestone/date audit filters.'
    }, evidence);
  }

  const apiKey = String(getScriptProperty_('GEMINI_API_KEY') || '').trim();
  if (!apiKey) {
    return recordEssentialAuditResult_(input, {
      audit_type: 'milestone_date',
      entity_id: entityId,
      milestone_id: milestoneId,
      result: TRUST_LAYER.AUDIT_RESULT.AMBIGUOUS,
      expected_value: official.expected_value || official.target_date || official.date || '',
      observed_value: '',
      evidence_quote: '',
      evidence_locator: '',
      confidence: 0,
      needs_human_review: true,
      notes: 'Gemini is not configured, so source evidence requires human review.'
    }, evidence);
  }

  const prompt = buildEssentialMilestoneAuditPrompt_(official, evidence);
  const responseText = fetchGeminiTrustLayerJson_(apiKey, getGeminiCommunicationModel_(), prompt);
  const parsed = parseEssentialAuditResponse_(responseText, evidence.text);
  return recordEssentialAuditResult_(input, parsed, evidence);
}

function buildEssentialAuditEvidencePacket_(text, official, options) {
  const blocks = chunkSourceTextForEssentialAudit_(text);
  const keywords = buildEssentialAuditKeywords_(official || {});
  const scored = blocks.map(block => {
    const haystack = normalizeTrustText_(block.heading + ' ' + block.text);
    const score = keywords.reduce((sum, keyword) => sum + (keyword && haystack.indexOf(keyword) >= 0 ? 1 : 0), 0);
    return Object.assign({}, block, {
      score: score
    });
  }).filter(block => block.score > 0);

  const selected = [];
  const byIndex = {};
  scored.sort((a, b) => b.score - a.score || a.index - b.index).forEach(block => {
    [block.index - 1, block.index, block.index + 1].forEach(index => {
      if (index < 0 || index >= blocks.length || byIndex[index]) return;
      byIndex[index] = true;
      selected.push(blocks[index]);
    });
  });

  selected.sort((a, b) => a.index - b.index);
  const limit = Number(options.blockLimit || TRUST_LAYER.DEFAULT_EVIDENCE_BLOCK_LIMIT);
  const charLimit = Number(options.charLimit || TRUST_LAYER.DEFAULT_EVIDENCE_CHAR_LIMIT);
  const limited = [];
  let chars = 0;
  selected.some(block => {
    const blockText = formatEssentialAuditBlock_(block);
    if (limited.length >= limit || chars + blockText.length > charLimit) return true;
    limited.push(block);
    chars += blockText.length;
    return false;
  });

  return {
    blocks: limited,
    text: limited.map(formatEssentialAuditBlock_).join('\n\n')
  };
}

function chunkSourceTextForEssentialAudit_(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let heading = '';
  let buffer = [];

  function flush() {
    const value = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (value) {
      blocks.push({
        index: blocks.length,
        heading: heading,
        text: value,
        locator: heading ? heading + ' #' + (blocks.length + 1) : 'paragraph #' + (blocks.length + 1)
      });
    }
    buffer = [];
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      return;
    }
    if (isEssentialAuditHeading_(trimmed)) {
      flush();
      heading = trimmed.replace(/^#+\s*/, '');
      return;
    }
    buffer.push(trimmed);
  });
  flush();
  return blocks;
}

function isEssentialAuditHeading_(line) {
  if (/^#{1,6}\s+/.test(line)) return true;
  if (line.length <= 90 && /^(phase|milestone|target|launch|release|timeline|status|risk|date)\b/i.test(line)) return true;
  return false;
}

function buildEssentialAuditKeywords_(official) {
  const base = [
    official.milestone_id,
    official.milestone_name,
    official.name,
    official.expected_value,
    official.target_date,
    official.date,
    official.phase,
    'launch',
    'phase',
    'milestone',
    'target',
    'date',
    'eta',
    'deadline',
    'go live',
    'go-live',
    'release'
  ];
  return base.map(normalizeTrustText_).filter(Boolean);
}

function normalizeTrustText_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatEssentialAuditBlock_(block) {
  return '[' + (block.locator || block.heading || 'source') + ']\n' + block.text;
}

function buildEssentialMilestoneAuditPrompt_(official, evidence) {
  return [
    'You are a strict compliance auditor.',
    'Review only the evidence packet below against the known official milestone state.',
    'Do not infer from outside knowledge. Do not summarize the whole document.',
    'If the target date/status changed, return DRIFT with the exact quote proving it.',
    'If there is no change, return NO_CHANGE.',
    'If evidence is conflicting or unclear, return AMBIGUOUS.',
    'If evidence does not mention the milestone, return INSUFFICIENT_EVIDENCE.',
    'Return only strict JSON matching this shape:',
    '{"audit_type":"milestone_date","entity_id":"","milestone_id":"","result":"NO_CHANGE|DRIFT|AMBIGUOUS|INSUFFICIENT_EVIDENCE","expected_value":"","observed_value":"","evidence_quote":"","evidence_locator":"","confidence":0,"needs_human_review":true,"notes":""}',
    'Known official milestone JSON:',
    JSON.stringify(official || {}),
    'Evidence packet:',
    evidence.text || ''
  ].join('\n');
}

function fetchGeminiTrustLayerJson_(apiKey, model, prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    })
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw buildGeminiCommunicationHttpError_(status, body);
  }
  const parsed = JSON.parse(body);
  const parts = parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts || [];
  const text = parts.map(part => part.text || '').join('').trim();
  if (!text) throw new Error('Gemini audit returned an empty response.');
  return text;
}

function parseEssentialAuditResponse_(responseText, evidenceText) {
  const parsed = JSON.parse(extractGeminiCommunicationJson_(responseText));
  const result = String(parsed.result || '').trim().toUpperCase();
  const allowed = Object.keys(TRUST_LAYER.AUDIT_RESULT).map(key => TRUST_LAYER.AUDIT_RESULT[key]);
  if (allowed.indexOf(result) < 0) throw new Error('Gemini audit returned unsupported result: ' + result);

  const evidenceQuote = String(parsed.evidence_quote || parsed.evidenceQuote || '').trim();
  if (result === TRUST_LAYER.AUDIT_RESULT.DRIFT && (!evidenceQuote || String(evidenceText || '').indexOf(evidenceQuote) < 0)) {
    parsed.result = TRUST_LAYER.AUDIT_RESULT.AMBIGUOUS;
    parsed.needs_human_review = true;
    parsed.notes = 'Gemini reported drift but did not provide an exact evidence quote.';
    parsed.evidence_quote = '';
  }

  return {
    audit_type: parsed.audit_type || 'milestone_date',
    entity_id: parsed.entity_id || '',
    milestone_id: parsed.milestone_id || '',
    result: parsed.result || result,
    expected_value: parsed.expected_value || '',
    observed_value: parsed.observed_value || '',
    evidence_quote: parsed.evidence_quote || evidenceQuote,
    evidence_locator: parsed.evidence_locator || '',
    confidence: Number(parsed.confidence || 0),
    needs_human_review: parsed.needs_human_review !== false,
    notes: parsed.notes || ''
  };
}

function recordEssentialAuditResult_(input, audit, evidence) {
  const event = appendUnifiedEventLocked_({
    eventType: 'extract.milestone_audit',
    entityType: input.entityType || 'Project',
    entityId: audit.entity_id || input.entityId || '',
    flowId: input.flowId || audit.entity_id || '',
    sourceType: input.sourceType || 'docs',
    sourceId: input.sourceId || input.documentId || '',
    sourceUrl: input.sourceUrl || '',
    sourceLocator: audit.evidence_locator || '',
    evidenceQuote: audit.evidence_quote || '',
    eventStatus: audit.result === TRUST_LAYER.AUDIT_RESULT.NO_CHANGE ? TRUST_LAYER.EVENT_STATUS.SKIPPED : TRUST_LAYER.EVENT_STATUS.PENDING,
    payload: {
      audit: audit,
      evidence_blocks: evidence.blocks || [],
      evidence_char_count: String(evidence.text || '').length
    }
  });
  return {
    ok: true,
    audit: audit,
    evidenceBlockCount: evidence.blocks.length,
    eventId: event.eventId,
    duplicate: event.duplicate
  };
}

function reconcileAlignmentEvents() {
  return runSkillOrThrow_('reconcile_alignment_events', {});
}

function handleReconcileAlignmentEventsSkill_() {
  const ss = getControlCenterSpreadsheet_();
  const eventSheet = ensureSheet_(ss, HUB.SHEETS.UNIFIED_EVENT_LOG, HUB.HEADERS.UNIFIED_EVENT_LOG);
  const rows = getObjects_(eventSheet);
  let risksCreated = 0;
  let processed = 0;
  let errors = 0;

  rows.forEach(event => {
    if (String(event['Event Status'] || '') !== TRUST_LAYER.EVENT_STATUS.PENDING) return;
    const rowNumber = findTrustLayerRowById_(eventSheet, 'Event ID', event['Event ID']);
    try {
      const payload = parseJsonObject_(event['Payload JSON']);
      const audit = payload.audit || {};
      if (event['Event Type'] === 'extract.milestone_audit' && audit.result === TRUST_LAYER.AUDIT_RESULT.DRIFT) {
        const risk = createAlignmentRiskFromAuditEvent_(event, audit);
        if (risk.created) risksCreated += 1;
        if (rowNumber) {
          updateRowFields_(eventSheet, rowNumber, {
            'Event Status': TRUST_LAYER.EVENT_STATUS.PROCESSED,
            'Alignment Risk ID': risk.riskId,
            'Processed At': nowIso_(),
            'Processing Error': ''
          });
        }
        processed += 1;
      } else {
        if (rowNumber) {
          updateRowFields_(eventSheet, rowNumber, {
            'Event Status': TRUST_LAYER.EVENT_STATUS.SKIPPED,
            'Processed At': nowIso_(),
            'Processing Error': ''
          });
        }
      }
    } catch (error) {
      errors += 1;
      if (rowNumber) {
        updateRowFields_(eventSheet, rowNumber, {
          'Event Status': TRUST_LAYER.EVENT_STATUS.ERROR,
          'Processed At': nowIso_(),
          'Processing Error': error.message || String(error)
        });
      }
    }
  });

  const collisionResult = detectTimingResourceCollisions_();
  return {
    processed: processed,
    risksCreated: risksCreated + collisionResult.risksCreated,
    timingCollisions: collisionResult.risksCreated,
    errors: errors
  };
}

function createAlignmentRiskFromAuditEvent_(event, audit) {
  const riskType = audit.audit_type === 'milestone_date' ? 'Milestone Drift' : 'Status Drift';
  const riskKey = [
    riskType,
    event['Entity ID'],
    audit.milestone_id || '',
    event['Payload Hash']
  ].join('|');
  const riskId = 'risk-' + hashString_(riskKey).slice(0, 16);
  const ss = getControlCenterSpreadsheet_();
  const sheet = ensureSheet_(ss, HUB.SHEETS.ALIGNMENT_RISKS, HUB.HEADERS.ALIGNMENT_RISKS);
  const existing = getObjects_(sheet).find(row =>
    row['Risk ID'] === riskId ||
    (row.Status === TRUST_LAYER.RISK_STATUS.OPEN && row['Entity ID'] === event['Entity ID'] && row['Risk Type'] === riskType && row['Evidence Event IDs'] === event['Event ID'])
  );
  if (existing) {
    return {
      riskId: existing['Risk ID'],
      created: false
    };
  }

  const now = nowIso_();
  const observed = {
    observed_value: audit.observed_value || '',
    evidence_quote: audit.evidence_quote || '',
    evidence_locator: audit.evidence_locator || ''
  };
  const official = {
    expected_value: audit.expected_value || '',
    milestone_id: audit.milestone_id || ''
  };
  const summary = buildAlignmentRiskEvidenceSummary_(riskType, event, audit);
  const communication = buildLeadershipAlignmentCommunicationSuggestion_(riskType, event, audit, summary);
  insertByHeadersAtTop_(sheet, HUB.HEADERS.ALIGNMENT_RISKS, {
    'Risk ID': riskId,
    'Created At': now,
    'Updated At': now,
    'Entity Type': event['Entity Type'] || 'Project',
    'Entity ID': event['Entity ID'] || '',
    'Flow ID': event['Flow ID'] || '',
    'Risk Type': riskType,
    Severity: audit.confidence >= 0.8 ? 'High' : 'Medium',
    Status: TRUST_LAYER.RISK_STATUS.OPEN,
    'Official State JSON': stringifyJson_(official),
    'Observed State JSON': stringifyJson_(observed),
    'Evidence Event IDs': event['Event ID'],
    'Evidence Summary': summary,
    'Suggested Registry Patch JSON': stringifyJson_({
      milestone_id: audit.milestone_id || '',
      target_value: audit.observed_value || ''
    }),
    'Suggested Communication JSON': stringifyJson_(communication),
    'Resolved By': '',
    'Resolved At': '',
    Resolution: '',
    Error: ''
  });
  appendUnifiedEventLocked_({
    eventType: 'alignment.risk_created',
    entityType: event['Entity Type'] || 'Project',
    entityId: event['Entity ID'] || '',
    flowId: event['Flow ID'] || '',
    parentEventId: event['Event ID'],
    alignmentRiskId: riskId,
    eventStatus: TRUST_LAYER.EVENT_STATUS.PROCESSED,
    payload: {
      risk_id: riskId,
      risk_type: riskType,
      summary: summary
    }
  });
  return {
    riskId: riskId,
    created: true
  };
}

function buildAlignmentRiskEvidenceSummary_(riskType, event, audit) {
  if (riskType === 'Timing/Resource Collision') return String(audit.notes || 'Timing overlap detected.');
  return [
    riskType + ' detected for ' + (event['Entity ID'] || 'project'),
    audit.milestone_id ? 'milestone ' + audit.milestone_id : '',
    audit.expected_value ? 'expected ' + audit.expected_value : '',
    audit.observed_value ? 'observed ' + audit.observed_value : '',
    audit.evidence_quote ? 'Evidence: "' + audit.evidence_quote + '"' : ''
  ].filter(Boolean).join('; ');
}

function buildLeadershipAlignmentCommunicationSuggestion_(riskType, event, audit, summary) {
  const subject = event['Entity ID'] || event['Flow ID'] || 'Project';
  return {
    audience_mode: 'ELI5 for Leadership',
    title: subject + ': alignment risk needs review',
    body: [
      'A source artifact appears to disagree with the official project state.',
      summary,
      'Recommended next step: confirm the official date/status, then decide whether leadership needs a timeline update.'
    ].join('\n')
  };
}

function detectTimingResourceCollisions_() {
  const ss = getControlCenterSpreadsheet_();
  const exportSheet = ss.getSheetByName(AUTOMATION.SHEETS.EXPORT);
  if (!exportSheet) return { risksCreated: 0 };
  const rows = getObjects_(exportSheet)
    .filter(row => String(row['Record Type'] || '') === 'Project' && !isExplicitlyInactive_(row.Active));
  let risksCreated = 0;
  for (let i = 0; i < rows.length; i++) {
    const delayedProject = rows[i];
    const delayedEta = parseAutomationDate_(delayedProject['Next Gate ETA']);
    if (!delayedEta || !looksDelayedProject_(delayedProject)) continue;
    for (let j = 0; j < rows.length; j++) {
      if (i === j) continue;
      const candidate = rows[j];
      const startDate = parseAutomationDate_(candidate['Next Gate ETA']);
      if (!startDate) continue;
      const deltaDays = Math.abs(startDate.getTime() - delayedEta.getTime()) / (24 * 60 * 60 * 1000);
      if (deltaDays > 7) continue;
      const created = createTimingCollisionRisk_(delayedProject, candidate, delayedEta, startDate);
      if (created) risksCreated += 1;
    }
  }
  return { risksCreated: risksCreated };
}

function looksDelayedProject_(row) {
  const text = [
    row.Status,
    row['Risk Level'],
    row['Primary Risk'],
    row.Notes
  ].join(' ').toLowerCase();
  return /delay|delayed|blocked|blocker|risk|yellow|red|\uD83D\uDFE1|\uD83D\uDD34|not ready/.test(text);
}

function createTimingCollisionRisk_(delayedProject, candidate, delayedEta, startDate) {
  const riskKey = [
    'Timing/Resource Collision',
    delayedProject['Flow ID'],
    candidate['Flow ID'],
    delayedEta.toISOString(),
    startDate.toISOString()
  ].join('|');
  const riskId = 'risk-' + hashString_(riskKey).slice(0, 16);
  const ss = getControlCenterSpreadsheet_();
  const sheet = ensureSheet_(ss, HUB.SHEETS.ALIGNMENT_RISKS, HUB.HEADERS.ALIGNMENT_RISKS);
  const existing = getObjects_(sheet).find(row => row['Risk ID'] === riskId || (
    row.Status === TRUST_LAYER.RISK_STATUS.OPEN &&
    row['Risk Type'] === 'Timing/Resource Collision' &&
    row['Entity ID'] === delayedProject['Flow ID'] &&
    String(row['Observed State JSON'] || '').indexOf(candidate['Flow ID']) >= 0
  ));
  if (existing) return false;

  const summary = 'Potential timing/resource collision: ' +
    (delayedProject.Subject || delayedProject['Flow ID']) +
    ' now overlaps ' +
    (candidate.Subject || candidate['Flow ID']) +
    ' within 7 days.';
  const now = nowIso_();
  insertByHeadersAtTop_(sheet, HUB.HEADERS.ALIGNMENT_RISKS, {
    'Risk ID': riskId,
    'Created At': now,
    'Updated At': now,
    'Entity Type': 'Project',
    'Entity ID': delayedProject['Flow ID'] || delayedProject['Source Item ID'],
    'Flow ID': delayedProject['Flow ID'] || '',
    'Risk Type': 'Timing/Resource Collision',
    Severity: 'Medium',
    Status: TRUST_LAYER.RISK_STATUS.OPEN,
    'Official State JSON': stringifyJson_({
      project: delayedProject.Subject || '',
      next_gate_eta: delayedProject['Next Gate ETA'] || ''
    }),
    'Observed State JSON': stringifyJson_({
      overlapping_project: candidate.Subject || '',
      overlapping_flow_id: candidate['Flow ID'] || '',
      overlapping_date: candidate['Next Gate ETA'] || ''
    }),
    'Evidence Event IDs': '',
    'Evidence Summary': summary,
    'Suggested Registry Patch JSON': '{}',
    'Suggested Communication JSON': stringifyJson_({
      audience_mode: 'ELI5 for Leadership',
      title: (delayedProject.Subject || 'Project') + ': timing collision needs review',
      body: summary + '\nRecommended next step: confirm staffing/timeline impact and whether leadership needs an update.'
    }),
    'Resolved By': '',
    'Resolved At': '',
    Resolution: '',
    Error: ''
  });
  appendUnifiedEventLocked_({
    eventType: 'alignment.risk_created',
    entityType: 'Project',
    entityId: delayedProject['Flow ID'] || '',
    flowId: delayedProject['Flow ID'] || '',
    alignmentRiskId: riskId,
    eventStatus: TRUST_LAYER.EVENT_STATUS.PROCESSED,
    payload: {
      risk_id: riskId,
      risk_type: 'Timing/Resource Collision',
      summary: summary
    }
  });
  return true;
}

function rollupProjectHistoryAndPrune() {
  return runSkillOrThrow_('rollup_project_history', {});
}

function handleRollupProjectHistorySkill_() {
  const ss = getControlCenterSpreadsheet_();
  const eventSheet = ensureSheet_(ss, HUB.SHEETS.UNIFIED_EVENT_LOG, HUB.HEADERS.UNIFIED_EVENT_LOG);
  const historySheet = ensureSheet_(ss, HUB.SHEETS.PROJECT_HISTORY, HUB.HEADERS.PROJECT_HISTORY);
  const rows = getObjects_(eventSheet);
  const byEntityDay = {};
  rows.forEach(row => {
    if (String(row['Event Status'] || '') !== TRUST_LAYER.EVENT_STATUS.PROCESSED) return;
    if (String(row['Rollup Status'] || '')) return;
    const entityId = row['Entity ID'] || row['Flow ID'];
    if (!entityId) return;
    const day = String(row['Created At'] || '').slice(0, 10);
    const key = [row['Entity Type'] || 'Project', entityId, day].join('|');
    if (!byEntityDay[key]) byEntityDay[key] = [];
    byEntityDay[key].push(row);
  });

  let summaries = 0;
  Object.keys(byEntityDay).forEach(key => {
    const events = byEntityDay[key];
    if (!events.length) return;
    const first = events[0];
    const day = String(first['Created At'] || '').slice(0, 10);
    const summary = summarizeTrustLayerEvents_(events);
    insertByHeadersAtTop_(historySheet, HUB.HEADERS.PROJECT_HISTORY, {
      'History ID': uuid_(),
      'Created At': nowIso_(),
      'History Date': day,
      'Entity Type': first['Entity Type'] || '',
      'Entity ID': first['Entity ID'] || '',
      'Flow ID': first['Flow ID'] || '',
      Summary: summary,
      'Source Event IDs': events.map(event => event['Event ID']).join(','),
      'Source Count': events.length,
      'Payload Hash': hashString_(summary),
      'Payload JSON': stringifyJson_({
        event_types: events.map(event => event['Event Type'])
      })
    });
    markEventsRolledUp_(eventSheet, events);
    summaries += 1;
  });

  const pruned = pruneRolledUpUnifiedEvents_(eventSheet, new Date());
  return {
    summaries: summaries,
    pruned: pruned
  };
}

function summarizeTrustLayerEvents_(events) {
  const pieces = events.map(event => {
    const payload = parseJsonObject_(event['Payload JSON']);
    const audit = payload.audit || {};
    if (audit.result === TRUST_LAYER.AUDIT_RESULT.DRIFT) {
      return 'Drift detected: ' + (audit.milestone_id || event['Event Type']) + ' moved from ' + (audit.expected_value || 'unknown') + ' to ' + (audit.observed_value || 'unknown') + '.';
    }
    if (event['Event Type'] === 'alignment.risk_created') {
      return 'Alignment risk created: ' + (payload.summary || event['Alignment Risk ID'] || event['Event ID']) + '.';
    }
    return event['Event Type'] + ' processed.';
  });
  return pieces.join(' ');
}

function markEventsRolledUp_(sheet, events) {
  events.forEach(event => {
    const row = findTrustLayerRowById_(sheet, 'Event ID', event['Event ID']);
    if (!row) return;
    updateRowFields_(sheet, row, {
      'Rollup Status': 'Rolled Up'
    });
  });
}

function pruneRolledUpUnifiedEvents_(sheet, now) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const retained = [];
  let pruned = 0;
  values.forEach(row => {
    const obj = headers.reduce((memo, header, index) => {
      memo[header] = row[index];
      return memo;
    }, {});
    const retentionDate = obj['Retention Until'] ? new Date(obj['Retention Until']) : null;
    const safeToPrune = obj['Rollup Status'] === 'Rolled Up' &&
      obj['Event Status'] === TRUST_LAYER.EVENT_STATUS.PROCESSED &&
      retentionDate &&
      !isNaN(retentionDate.getTime()) &&
      retentionDate < now;
    if (safeToPrune) {
      pruned += 1;
    } else {
      retained.push(row);
    }
  });
  if (pruned) {
    sheet.getRange(2, 1, values.length, headers.length).clearContent();
    if (retained.length) sheet.getRange(2, 1, retained.length, headers.length).setValues(retained);
  }
  return pruned;
}

function findTrustLayerRowById_(sheet, idHeader, id) {
  if (!sheet || !id || sheet.getLastRow() < 2) return 0;
  const headers = getHeaders_(sheet);
  const index = headers.indexOf(idHeader);
  if (index < 0) return 0;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][index]) === String(id)) return i + 2;
  }
  return 0;
}
