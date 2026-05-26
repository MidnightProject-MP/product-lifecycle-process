import assert from 'node:assert/strict';

function extractJson(text) {
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

function normalizeStringArray(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6);
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

function sanitizeHref(href) {
  const value = String(href || '').trim().replace(/&amp;/g, '&');
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return '';
}

function sanitizeBody(html) {
  let value = String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  value = value.replace(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi, (match, quoted, doubleQuoted, singleQuoted, bare) => {
    const href = sanitizeHref(doubleQuoted || singleQuoted || bare || '');
    return href ? `<a href="${href}">` : '<a>';
  });

  value = value
    .replace(/<\/a>/gi, '</a>')
    .replace(/<\s*(\/?)\s*(strong|b|em|i|p|br|ul|ol|li)\b[^>]*>/gi, '<$1$2>')
    .replace(/<(?!\/?(?:strong|b|em|i|p|br|ul|ol|li|a)(?:\s|>|\/))[^>]+>/gi, '');

  return value.trim();
}

function slackInlineToHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/&lt;([^|]+)\|([^&]+)&gt;/g, '<a href="$1">$2</a>')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function sanitizeTitle(html) {
  return sanitizeBody(html)
    .replace(/<\/?(p|div|ul|ol|li)[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseDraft(responseText, fallback, meta = {}) {
  const parsed = JSON.parse(extractJson(responseText));
  const titleMrkdwn = parsed.title_mrkdwn || parsed.titleMrkdwn || '';
  const bodyMrkdwn = parsed.body_mrkdwn || parsed.bodyMrkdwn || '';
  const titleHtml = sanitizeTitle(parsed.title_html || slackInlineToHtml(titleMrkdwn) || fallback.titleHtml || '');
  const bodyHtml = sanitizeBody(parsed.body_html || slackInlineToHtml(bodyMrkdwn).replace(/\n/g, '<br>') || fallback.bodyHtml || '');
  if (!stripHtml(titleHtml)) throw new Error('Gemini response did not include a usable title.');
  if (!stripHtml(bodyHtml)) throw new Error('Gemini response did not include a usable body.');
  return {
    source: 'gemini',
    titleMrkdwn,
    bodyMrkdwn,
    titleHtml,
    bodyHtml,
    formattingNotes: normalizeStringArray(parsed.formatting_notes),
    missingContext: normalizeStringArray(parsed.missing_context),
    model: meta.model || 'gemini-2.5-flash'
  };
}

function buildPrompt(context) {
  return [
    'You are the copy coach for an executive Slack communication review tool.',
    'Return only strict JSON. Do not wrap it in markdown fences.',
    'Do not approve, send, or invent facts.',
    'Use Slack mrkdwn only for title_mrkdwn and body_mrkdwn.',
    'Use Slack formatting: *bold*, _italic_, - bullets, numbered lists, and <https://url|link text>.',
    'Communication context JSON:',
    JSON.stringify(context)
  ].join('\n');
}

function missingApiKeyFallback(apiKey, fallback) {
  if (apiKey) return null;
  return {
    ok: true,
    aiAvailable: false,
    fallback: true,
    source: 'template_fallback',
    titleHtml: fallback.titleHtml,
    bodyHtml: fallback.bodyHtml
  };
}

function isRetryableStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(Number(status));
}

function friendlyGeminiError(error) {
  const status = Number(error && error.geminiStatus || 0);
  if (status === 429 || status === 503) {
    return 'Gemini is temporarily busy, so the template scaffold was loaded. You can keep editing or try AI Re-draft again in a minute.';
  }
  if (status >= 500) {
    return 'Gemini is temporarily unavailable, so the template scaffold was loaded. You can keep editing or try AI Re-draft again shortly.';
  }
  if (status === 401 || status === 403) {
    return 'Gemini is not authorized. Check GEMINI_API_KEY; the template scaffold was loaded instead.';
  }
  if (status === 404) {
    return 'Gemini model was not found. Check GEMINI_MODEL; the template scaffold was loaded instead.';
  }
  return 'Gemini was unavailable, so the template scaffold was loaded.';
}

const fallback = {
  titleHtml: '<strong>Fallback title</strong>',
  bodyHtml: '<p>Fallback body</p>'
};

assert.equal(
  extractJson('```json\n{"title_html":"Title","body_html":"Body"}\n```'),
  '{"title_html":"Title","body_html":"Body"}'
);

const parsed = parseDraft(JSON.stringify({
  title_mrkdwn: '*Guardian Portal* update',
  body_mrkdwn: '- *Status:* yellow\n- See <https://example.com?a=1&b=2|details>',
  formatting_notes: ['Kept labels bold'],
  missing_context: 'Decision owner'
}), fallback, { model: 'gemini-2.5-flash' });

assert.equal(parsed.titleHtml, '<strong>Guardian Portal</strong> update');
assert.equal(parsed.bodyHtml, '- <strong>Status:</strong> yellow<br>- See <a href="https://example.com?a=1&b=2">details</a>');
assert.equal(parsed.titleMrkdwn, '*Guardian Portal* update');
assert.equal(parsed.bodyMrkdwn, '- *Status:* yellow\n- See <https://example.com?a=1&b=2|details>');
assert.deepEqual(parsed.formattingNotes, ['Kept labels bold']);
assert.deepEqual(parsed.missingContext, ['Decision owner']);
assert.equal(parsed.model, 'gemini-2.5-flash');

assert.throws(() => parseDraft('not json', fallback), /did not contain JSON/);
assert.equal(
  parseDraft('{"title_mrkdwn":"","body_mrkdwn":"Body"}', fallback).titleHtml,
  '<strong>Fallback title</strong>'
);

assert.equal(
  sanitizeBody('<p>Bad <a href="javascript:alert(1)">link</a></p>'),
  '<p>Bad <a>link</a></p>'
);

const prompt = buildPrompt({
  event_key: 'release.scheduled',
  subject: 'Guardian Portal Special Release',
  primary_risk: 'Fixes are not ready yet'
});
assert.match(prompt, /release\.scheduled/);
assert.match(prompt, /Do not approve, send, or invent facts/);
assert.match(prompt, /Slack mrkdwn/);

assert.deepEqual(missingApiKeyFallback('', fallback), {
  ok: true,
  aiAvailable: false,
  fallback: true,
  source: 'template_fallback',
  titleHtml: fallback.titleHtml,
  bodyHtml: fallback.bodyHtml
});

assert.equal(isRetryableStatus(503), true);
assert.equal(isRetryableStatus(429), true);
assert.equal(isRetryableStatus(400), false);
assert.match(friendlyGeminiError({ geminiStatus: 503 }), /temporarily busy/);
assert.match(friendlyGeminiError({ geminiStatus: 429 }), /try AI Re-draft again in a minute/);
assert.match(friendlyGeminiError({ geminiStatus: 403 }), /GEMINI_API_KEY/);
assert.match(friendlyGeminiError({ geminiStatus: 404 }), /GEMINI_MODEL/);

console.log('Gemini copy coach tests passed.');
