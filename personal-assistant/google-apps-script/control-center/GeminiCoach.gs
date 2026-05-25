function getGeminiCommunicationModel_() {
  return String(getScriptProperty_('GEMINI_MODEL') || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';
}

function generateCommunicationDraftWithGemini_(form, options) {
  options = options || {};
  const fallback = buildGeminiCommunicationFallbackDraft_(form || {});
  const apiKey = String(getScriptProperty_('GEMINI_API_KEY') || '').trim();
  const model = getGeminiCommunicationModel_();

  if (!apiKey) {
    const result = Object.assign({}, fallback, {
      ok: true,
      aiAvailable: false,
      fallback: true,
      source: 'template_fallback',
      message: 'Gemini is not configured. Template scaffold loaded instead.',
      warnings: ['GEMINI_API_KEY is not set in Script Properties.']
    });
    persistGeminiDraftIfNeeded_(form || {}, result, options);
    return result;
  }

  try {
    const prompt = buildGeminiCommunicationPrompt_(form || {}, fallback, options);
    const responseText = fetchGeminiCommunicationDraft_(apiKey, model, prompt);
    const result = parseGeminiCommunicationDraft_(responseText, fallback, {
      model: model,
      mode: options.mode || 'initial'
    });
    persistGeminiDraftIfNeeded_(form || {}, result, options);
    return result;
  } catch (error) {
    logHub_('WARN', 'GeminiCoach', form && form.queueId || '', 'Gemini copy coach fell back to deterministic template scaffold.', {
      error: error.message || String(error),
      model: model,
      mode: options.mode || 'initial'
    });
    const result = Object.assign({}, fallback, {
      ok: true,
      aiAvailable: false,
      fallback: true,
      source: 'template_fallback',
      message: 'Gemini was unavailable. Template scaffold loaded instead.',
      warnings: [error.message || String(error)]
    });
    persistGeminiDraftIfNeeded_(form || {}, result, options);
    return result;
  }
}

function processPendingCommunicationAiDrafts(maxRows) {
  const apiKey = String(getScriptProperty_('GEMINI_API_KEY') || '').trim();
  if (!apiKey) {
    logHub_('INFO', 'processPendingCommunicationAiDrafts', '', 'Skipped AI draft worker because Gemini is not configured.', {});
    return {
      ok: true,
      processed: 0,
      skipped: 0,
      message: 'Gemini is not configured.'
    };
  }

  const sheet = getControlCenterSpreadsheet_().getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet) return {
    ok: true,
    processed: 0,
    skipped: 0,
    message: 'Queue sheet is missing.'
  };

  const rows = getObjects_(sheet);
  const limit = Number(maxRows || 5);
  let processed = 0;
  let skipped = 0;

  rows.some(row => {
    if (processed >= limit) return true;
    const status = String(row.Status || '').trim();
    if ([HUB.STATUS.DRAFT, HUB.STATUS.SCHEDULED].indexOf(status) < 0) {
      skipped += 1;
      return false;
    }

    const payload = normalizePayload_(row);
    if (payload.message_title_mrkdwn || payload.message_body_mrkdwn || payload.message_ai_status === 'AI_Complete') {
      skipped += 1;
      return false;
    }

    const form = {
      selection: 'queue:' + row['Queue ID'],
      queueId: row['Queue ID'],
      flowId: row['Flow ID'] || '',
      eventKey: row['Event Key'] || payload.event_key || '',
      subject: payload.subject || row.Subject || '',
      owner: payload.owner || row.Owner || '',
      messageTitle: payload.message_title || payload.subject || '',
      messageTitleHtml: payload.message_title_html || '',
      messageBodyHtml: payload.message_body_html || ''
    };
    try {
      markGeminiDraftStatus_(row['Queue ID'], 'AI_Pending');
      generateCommunicationDraftWithGemini_(form, {
        mode: 'worker',
        persist: true
      });
      processed += 1;
    } catch (error) {
      markGeminiDraftStatus_(row['Queue ID'], 'AI_Error', error.message || String(error));
      logHub_('WARN', 'processPendingCommunicationAiDrafts', row['Queue ID'], 'AI draft worker failed for Queue row.', {
        error: error.message || String(error)
      });
    }
    return false;
  });

  return {
    ok: true,
    processed: processed,
    skipped: skipped,
    message: 'AI draft worker processed ' + processed + ' draft(s).'
  };
}

function buildGeminiCommunicationFallbackDraft_(form) {
  const item = buildGeminiCommunicationItem_(form || {});
  try {
    const template = findReviewControllerTemplateForPreview_(item);
    const rendered = renderTemplate_(getTemplateAnchorText_(template), item);
    const split = splitRenderedMessageForEditor_(rendered, getReviewControllerSubject_(item, normalizePayload_(item)));
    const titleMrkdwn = htmlToSlackText_(split.titleHtml || reviewControllerPlainTextToHtml_(split.title || '')).trim();
    const bodyMrkdwn = htmlToSlackText_(split.bodyHtml || '').trim();
    return {
      ok: true,
      aiAvailable: true,
      fallback: false,
      source: 'template',
      titleMrkdwn: titleMrkdwn,
      bodyMrkdwn: bodyMrkdwn,
      titleHtml: split.titleHtml || reviewControllerPlainTextToHtml_(split.title || ''),
      bodyHtml: split.bodyHtml || '',
      formattingNotes: [],
      missingContext: [],
      warnings: [],
      model: getGeminiCommunicationModel_(),
      generatedAt: nowIso_()
    };
  } catch (error) {
    const title = stringFromForm_(form.messageTitle) || stringFromForm_(form.subject) || 'Communication update';
    const titleHtml = sanitizeGeminiCommunicationTitleHtml_(form.messageTitleHtml || reviewControllerPlainTextToHtml_(title));
    const bodyHtml = sanitizeGeminiCommunicationBodyHtml_(form.messageBodyHtml || '');
    return {
      ok: true,
      aiAvailable: true,
      fallback: false,
      source: 'fallback',
      titleMrkdwn: htmlToSlackText_(titleHtml || title).trim(),
      bodyMrkdwn: htmlToSlackText_(bodyHtml).trim(),
      titleHtml: titleHtml,
      bodyHtml: bodyHtml,
      formattingNotes: [],
      missingContext: [],
      warnings: [error.message || String(error)],
      model: getGeminiCommunicationModel_(),
      generatedAt: nowIso_()
    };
  }
}

function buildGeminiCommunicationItem_(form) {
  const item = buildReviewControllerPreviewItem_(form || {});
  const payload = normalizePayload_(item);
  payload.message_title = stringFromForm_(form.messageTitle) || payload.message_title || payload.subject || '';
  payload.message_title_html = stringFromForm_(form.messageTitleHtml) || payload.message_title_html || reviewControllerPlainTextToHtml_(payload.message_title || '');
  payload.message_body_html = stringFromForm_(form.messageBodyHtml) || payload.message_body_html || '';
  return Object.assign({}, item, {
    'Event Key': form.eventKey || item['Event Key'] || payload.event_key || '',
    'Payload JSON': stringifyJson_(payload)
  });
}

function buildGeminiCommunicationPrompt_(form, fallback, options) {
  const item = buildGeminiCommunicationItem_(form || {});
  const payload = normalizePayload_(item);
  const context = {
    mode: options && options.mode || 'initial',
    event_key: item['Event Key'] || payload.event_key || '',
    event_name: getReviewControllerEventDisplayName_(item['Event Key'] || payload.event_key || ''),
    flow_id: item['Flow ID'] || form.flowId || '',
    lane: item.Lane || payload.lane || '',
    subject: payload.subject || form.subject || '',
    owner: payload.owner || item.Owner || form.owner || '',
    source: item.Source || '',
    current_title_html: form.messageTitleHtml || fallback.titleHtml || '',
    current_body_html: form.messageBodyHtml || fallback.bodyHtml || '',
    current_title_mrkdwn: htmlToSlackText_(form.messageTitleHtml || fallback.titleHtml || '').trim(),
    current_body_mrkdwn: htmlToSlackText_(form.messageBodyHtml || fallback.bodyHtml || '').trim(),
    template_title_mrkdwn: fallback.titleMrkdwn || htmlToSlackText_(fallback.titleHtml || '').trim(),
    template_body_mrkdwn: fallback.bodyMrkdwn || htmlToSlackText_(fallback.bodyHtml || '').trim(),
    what: payload.what || '',
    so_what: payload.so_what || '',
    whats_next: payload.whats_next || '',
    project: payload.project || '',
    release_date: payload.release_date || '',
    release_status: payload.release_status || '',
    risk_level: payload.risk_level || '',
    confidence: payload.confidence || '',
    primary_risk: payload.primary_risk || '',
    next_gate: payload.next_gate || '',
    next_gate_eta: payload.next_gate_eta || '',
    notes: payload.notes || ''
  };

  return [
    'You are the copy coach for an executive Slack communication review tool.',
    'Return only strict JSON. Do not wrap it in markdown fences.',
    'The PM will review and save the result. Do not approve, send, or invent facts.',
    'Produce concise executive-ready copy while preserving the PM intent and all factual details.',
    'Use Slack mrkdwn only for title_mrkdwn and body_mrkdwn.',
    'Use Slack formatting: *bold*, _italic_, - bullets, numbered lists, and <https://url|link text>.',
    'Preserve status icons, emojis, dates, names, and IDs exactly when present.',
    'Prefer a clear title and a scannable body. Bold labels inside bullets when useful.',
    'If important context is missing, keep the draft usable and list missing items in missing_context.',
    'Required JSON shape:',
    '{"title_mrkdwn":"*Title*","body_mrkdwn":"- *Status:* update","formatting_notes":["short note"],"missing_context":["short warning"]}',
    'Communication context JSON:',
    JSON.stringify(context)
  ].join('\n');
}

function fetchGeminiCommunicationDraft_(apiKey, model, prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: 'application/json'
      }
    })
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('Gemini API returned HTTP ' + status + ': ' + body.slice(0, 300));
  }

  const parsed = JSON.parse(body);
  const candidates = parsed.candidates || [];
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts || [];
  const text = parts.map(part => part.text || '').join('').trim();
  if (!text) throw new Error('Gemini API returned an empty response.');
  return text;
}

function parseGeminiCommunicationDraft_(responseText, fallback, meta) {
  const jsonText = extractGeminiCommunicationJson_(responseText);
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') throw new Error('Gemini response was not an object.');

  const titleMrkdwn = sanitizeGeminiCommunicationMrkdwn_(parsed.title_mrkdwn || parsed.titleMrkdwn || htmlToSlackText_(parsed.title_html || parsed.titleHtml || fallback.titleHtml || ''));
  const bodyMrkdwn = sanitizeGeminiCommunicationMrkdwn_(parsed.body_mrkdwn || parsed.bodyMrkdwn || htmlToSlackText_(parsed.body_html || parsed.bodyHtml || fallback.bodyHtml || ''));
  const titleHtml = reviewControllerSlackInlineToHtml_(titleMrkdwn || fallback.titleMrkdwn || htmlToSlackText_(fallback.titleHtml || ''));
  const bodyHtml = slackTextToReviewControllerHtml_(bodyMrkdwn || fallback.bodyMrkdwn || htmlToSlackText_(fallback.bodyHtml || ''));
  if (!stripHtml_(titleHtml)) throw new Error('Gemini response did not include a usable title.');
  if (!stripHtml_(bodyHtml)) throw new Error('Gemini response did not include a usable body.');

  return {
    ok: true,
    aiAvailable: true,
    fallback: false,
    source: 'gemini',
    titleMrkdwn: titleMrkdwn,
    bodyMrkdwn: bodyMrkdwn,
    titleHtml: titleHtml,
    bodyHtml: bodyHtml,
    formattingNotes: normalizeGeminiStringArray_(parsed.formatting_notes || parsed.formattingNotes),
    missingContext: normalizeGeminiStringArray_(parsed.missing_context || parsed.missingContext),
    warnings: [],
    model: meta && meta.model || getGeminiCommunicationModel_(),
    generatedAt: nowIso_(),
    mode: meta && meta.mode || 'initial',
    message: meta && meta.mode === 'redraft' ? 'AI re-draft ready.' : 'AI draft ready.'
  };
}

function extractGeminiCommunicationJson_(text) {
  const raw = String(text || '').trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  if (raw.charAt(0) === '{') return raw;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini response did not contain JSON.');
  return raw.slice(start, end + 1);
}

function normalizeGeminiStringArray_(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6);
}

function sanitizeGeminiCommunicationMrkdwn_(value) {
  return String(value || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<[^|>\s]+(?:\s[^>]*)?>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function sanitizeGeminiCommunicationTitleHtml_(html) {
  let value = sanitizeGeminiCommunicationBodyHtml_(html);
  value = value
    .replace(/<\/?(p|div|ul|ol|li)[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return value || reviewControllerPlainTextToHtml_(stripHtml_(html));
}

function sanitizeGeminiCommunicationBodyHtml_(html) {
  let value = String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  value = value.replace(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi, function(match, quoted, doubleQuoted, singleQuoted, bare) {
    const href = sanitizeGeminiHref_(doubleQuoted || singleQuoted || bare || '');
    return href ? '<a href="' + escapeReviewControllerHtml_(href) + '">' : '<a>';
  });

  value = value
    .replace(/<\/a>/gi, '</a>')
    .replace(/<\s*(\/?)\s*(strong|b|em|i|p|br|ul|ol|li)\b[^>]*>/gi, '<$1$2>')
    .replace(/<(?!\/?(?:strong|b|em|i|p|br|ul|ol|li|a)(?:\s|>|\/))[^>]+>/gi, '');

  return value.trim();
}

function sanitizeGeminiHref_(href) {
  const value = decodeHtmlEntities_(String(href || '').trim());
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return '';
}

function persistGeminiDraftIfNeeded_(form, result, options) {
  if (!options || options.persist !== true) return;
  const queueId = stringFromForm_(form && form.queueId) || parseGeminiQueueIdFromSelection_(form && form.selection);
  if (!queueId) return;

  if (!result || result.source !== 'gemini') {
    markGeminiDraftStatus_(queueId, result && result.source === 'template_fallback' ? 'AI_Unavailable' : 'AI_Skipped', result && result.message || '');
    return;
  }

  const sheet = getControlCenterSpreadsheet_().getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet) return;
  const row = findQueueRowByQueueId_(sheet, queueId);
  if (!row) return;

  const item = getRowObject_(sheet, row);
  const payload = normalizePayload_(item);
  payload.message_title = stripHtml_(result.titleHtml || '') || cleanReviewControllerTitle_(result.titleMrkdwn || '');
  payload.message_title_mrkdwn = String(result.titleMrkdwn || htmlToSlackText_(result.titleHtml || '')).trim();
  payload.message_body_mrkdwn = String(result.bodyMrkdwn || htmlToSlackText_(result.bodyHtml || '')).trim();
  payload.message_format = 'mrkdwn_v1';
  payload.message_ai_status = 'AI_Complete';
  payload.message_ai_model = result.model || getGeminiCommunicationModel_();
  payload.message_ai_generated_at = result.generatedAt || nowIso_();
  delete payload.message_title_html;
  delete payload.message_body_html;

  updateRowFields_(sheet, row, {
    'Payload JSON': stringifyJson_(payload),
    'Updated At': nowIso_()
  });
}

function markGeminiDraftStatus_(queueId, status, error) {
  const sheet = getControlCenterSpreadsheet_().getSheetByName(HUB.SHEETS.QUEUE);
  if (!sheet || !queueId) return;
  const row = findQueueRowByQueueId_(sheet, queueId);
  if (!row) return;
  const item = getRowObject_(sheet, row);
  const payload = normalizePayload_(item);
  payload.message_ai_status = status || '';
  if (error) payload.message_ai_error = String(error).slice(0, 500);
  updateRowFields_(sheet, row, {
    'Payload JSON': stringifyJson_(payload),
    'Updated At': nowIso_()
  });
}

function parseGeminiQueueIdFromSelection_(selection) {
  const text = String(selection || '');
  const match = text.match(/^queue:(.+)$/);
  return match ? match[1] : '';
}
