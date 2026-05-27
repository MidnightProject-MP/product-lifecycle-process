import assert from 'node:assert/strict';

function hashString(text) {
  let hash = 0;
  for (const char of String(text || '')) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return String(hash);
}

function buildUnifiedEventIdempotencyKey(event) {
  if (event['Correlation ID']) return 'correlation|' + event['Correlation ID'];
  return [
    event['Event Type'] || '',
    event['Source Type'] || '',
    event['Source ID'] || '',
    event['Source Locator'] || '',
    event['Payload Hash'] || ''
  ].join('|');
}

function normalizeTrustText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isHeading(line) {
  if (/^#{1,6}\s+/.test(line)) return true;
  if (line.length <= 90 && /^(phase|milestone|target|launch|release|timeline|status|risk|date)\b/i.test(line)) return true;
  return false;
}

function chunkSourceText(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let heading = '';
  let buffer = [];

  function flush() {
    const value = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (value) {
      blocks.push({
        index: blocks.length,
        heading,
        text: value,
        locator: heading ? `${heading} #${blocks.length + 1}` : `paragraph #${blocks.length + 1}`
      });
    }
    buffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (isHeading(trimmed)) {
      flush();
      heading = trimmed.replace(/^#+\s*/, '');
      continue;
    }
    buffer.push(trimmed);
  }
  flush();
  return blocks;
}

function buildKeywords(official) {
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
  return base.map(normalizeTrustText).filter(Boolean);
}

function formatBlock(block) {
  return `[${block.locator || block.heading || 'source'}]\n${block.text}`;
}

function buildEvidencePacket(text, official, options = {}) {
  const blocks = chunkSourceText(text);
  const keywords = buildKeywords(official || {});
  const scored = blocks.map(block => {
    const haystack = normalizeTrustText(`${block.heading} ${block.text}`);
    const score = keywords.reduce((sum, keyword) => sum + (keyword && haystack.includes(keyword) ? 1 : 0), 0);
    return { ...block, score };
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
  const limit = Number(options.blockLimit || 12);
  const charLimit = Number(options.charLimit || 12000);
  const limited = [];
  let chars = 0;
  selected.some(block => {
    const blockText = formatBlock(block);
    if (limited.length >= limit || chars + blockText.length > charLimit) return true;
    limited.push(block);
    chars += blockText.length;
    return false;
  });

  return {
    blocks: limited,
    text: limited.map(formatBlock).join('\n\n')
  };
}

function parseAuditResponse(responseText, evidenceText) {
  const parsed = JSON.parse(responseText);
  const result = String(parsed.result || '').trim().toUpperCase();
  const allowed = ['NO_CHANGE', 'DRIFT', 'AMBIGUOUS', 'INSUFFICIENT_EVIDENCE'];
  if (!allowed.includes(result)) throw new Error(`unsupported result: ${result}`);
  const quote = String(parsed.evidence_quote || '').trim();
  if (result === 'DRIFT' && (!quote || !String(evidenceText || '').includes(quote))) {
    parsed.result = 'AMBIGUOUS';
    parsed.needs_human_review = true;
    parsed.notes = 'Gemini reported drift but did not provide an exact evidence quote.';
    parsed.evidence_quote = '';
  }
  return parsed;
}

function looksDelayedProject(row) {
  const text = [
    row.Status,
    row['Risk Level'],
    row['Primary Risk'],
    row.Notes
  ].join(' ').toLowerCase();
  return /delay|delayed|blocked|blocker|risk|yellow|red|\uD83D\uDFE1|\uD83D\uDD34|not ready/.test(text);
}

function parseMonitoredSlackChannels(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map(channel => channel.trim())
    .filter(channel => /^C|^G/.test(channel))
    .filter((channel, index, list) => list.indexOf(channel) === index);
}

function buildSlackPullCursorConfigKey(channel) {
  return `SLACK_PULL_CURSOR_${String(channel || '').replace(/[^A-Z0-9]/gi, '_').toUpperCase()}`;
}

assert.equal(
  buildUnifiedEventIdempotencyKey({
    'Event Type': 'extract.milestone_audit',
    'Source Type': 'docs',
    'Source ID': 'doc-1',
    'Source Locator': 'Phase 1',
    'Payload Hash': 'abc'
  }),
  'extract.milestone_audit|docs|doc-1|Phase 1|abc'
);

assert.equal(
  buildUnifiedEventIdempotencyKey({
    'Correlation ID': 'slack-123',
    'Payload Hash': hashString('different')
  }),
  'correlation|slack-123'
);

const doc = [
  '# Charter',
  'This section is intentionally boring and should be ignored.',
  '',
  'Phase 1',
  'Pushing the migration to mid-June to accommodate IAM reviews.',
  '',
  'Appendix',
  'Lots of unrelated implementation notes.'
].join('\n');
const evidence = buildEvidencePacket(doc, {
  milestone_id: 'Phase 1',
  expected_value: '2026-06-01',
  milestone_name: 'Database Migration'
});

assert.equal(evidence.blocks.length > 0, true);
assert.match(evidence.text, /Pushing the migration to mid-June/);
assert.equal(evidence.blocks.length <= 12, true);

const validDrift = parseAuditResponse(JSON.stringify({
  result: 'DRIFT',
  evidence_quote: 'Pushing the migration to mid-June to accommodate IAM reviews.',
  observed_value: '2026-06-15'
}), evidence.text);
assert.equal(validDrift.result, 'DRIFT');

const invalidDrift = parseAuditResponse(JSON.stringify({
  result: 'DRIFT',
  evidence_quote: 'A quote that is not present.',
  observed_value: '2026-06-15'
}), evidence.text);
assert.equal(invalidDrift.result, 'AMBIGUOUS');
assert.equal(invalidDrift.evidence_quote, '');

assert.equal(
  looksDelayedProject({
    Status: 'YELLOW',
    'Primary Risk': 'Fixes are not ready yet'
  }),
  true
);
assert.equal(
  looksDelayedProject({
    Status: 'GREEN',
    'Primary Risk': ''
  }),
  false
);

assert.deepEqual(
  parseMonitoredSlackChannels('C123, G456\nnot-a-channel;C123'),
  ['C123', 'G456']
);
assert.equal(buildSlackPullCursorConfigKey('C123ABC'), 'SLACK_PULL_CURSOR_C123ABC');

console.log('Trust layer tests passed.');
