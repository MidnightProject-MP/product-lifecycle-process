function findTemplate_(item) {
  const payload = getPayload_(item);
  const eventKey = resolveCanonicalEventKey_(item['Event Key'] || payload.event_key || payload.eventKey || '', item['Communication Event'] || payload.communication_event || '');
  const event = findRegistryRow_('Event_Catalog', 'Event Key', eventKey);
  if (!event) {
    logHub_('ERROR', 'findTemplate_', item['Queue ID'], 'No event catalog row found.', { eventKey: eventKey });
    throw new Error('No event catalog row found for Event Key: ' + eventKey);
  }
  if (String(event.Active || '').toUpperCase() === 'FALSE') {
    throw new Error('Registry event is inactive for Event Key: ' + eventKey);
  }

  const templateKey = event['Template Key'];
  const templates = getRegistryObjects_('Templates').filter(row =>
    row['Template Key'] === templateKey &&
    String(row.Active || '').toUpperCase() !== 'FALSE'
  );
  const template = templates.length ? templates[templates.length - 1] : null;

  if (!template) {
    logHub_('ERROR', 'findTemplate_', item['Queue ID'], 'No active template found.', {
      eventKey: eventKey,
      templateKey: templateKey
    });
    throw new Error('No active template found for Template Key: ' + templateKey);
  }

  return Object.assign({}, template, {
    'Event Key': eventKey,
    'Channel Type': event['Channel Type'] || template['Channel Type'],
    'Default Send Rule': event['Send Rule'] || template['Default Send Rule'] || getRegistrySetting_('DEFAULT_REVIEW_MODE'),
    'Post Mode': event['Post Mode'] || template['Post Mode'],
    'Anchor Update Policy': event['Anchor Update Policy'] || template['Anchor Update Policy'] || '',
    'Thread Reply Policy': event['Thread Reply Policy'] || template['Thread Reply Policy'] || '',
    'Reply Broadcast': event['Reply Broadcast'] || template['Reply Broadcast'] || ''
  });
}

function resolveCanonicalEventKey_(eventKey, eventName) {
  const rawEventKey = String(eventKey || '').trim();
  const legacyEventKey = inferEventKeyFromLegacy_(rawEventKey || eventName);
  const candidate = legacyEventKey || rawEventKey;
  if (!candidate) return '';

  try {
    const directEvent = findRegistryRow_('Event_Catalog', 'Event Key', candidate);
    if (directEvent) return directEvent['Event Key'];

    const templateEvent = findRegistryRow_('Event_Catalog', 'Template Key', candidate);
    if (templateEvent) {
      logHub_('INFO', 'resolveCanonicalEventKey_', '', 'Normalized template key to Registry event key.', {
        provided: candidate,
        eventKey: templateEvent['Event Key']
      });
      return templateEvent['Event Key'];
    }

    const namedEvent = findRegistryRow_('Event_Catalog', 'Communication Event', rawEventKey || eventName);
    if (namedEvent) return namedEvent['Event Key'];
  } catch (error) {
    // Registry may be unavailable during early setup/debug. Keep the original
    // candidate so the caller can surface the real configuration error.
  }

  return candidate;
}

var HUB_REGISTRY_ROWS_CACHE_ = {};
var HUB_REGISTRY_SPREADSHEET_CACHE_ = null;
var HUB_REGISTRY_SPREADSHEET_ID_CACHE_ = '';
var HUB_REGISTRY_CACHEABLE_SHEETS_ = ['Settings', 'Event_Catalog', 'Templates', 'Template_Variables', 'Event_Transitions', 'Approval_Rules'];
var HUB_REGISTRY_CACHE_TTL_SECONDS_ = 300;

function renderTemplate_(text, item) {
  const payload = buildTemplatePayload_(item);
  return String(text || '').replace(/\\n/g, '\n').replace(/\{\{([^}]+)\}\}/g, (_, token) => {
    const key = token.trim();
    return payload[key] == null ? '' : String(payload[key]);
  });
}

function hasFinalMessageOverride_(item) {
  const payload = getPayload_(item);
  return Boolean(String(payload.message_title || '').trim() || String(payload.message_title_html || '').trim() || String(payload.message_body_html || '').trim());
}

function renderFinalAnchorMessage_(item) {
  const payload = getPayload_(item);
  const title = htmlToSlackText_(payload.message_title_html || payload.message_title || payload.subject || buildFlowSubject_(item, payload)).trim();
  const body = htmlToSlackText_(payload.message_body_html || '').trim();
  return [title, body].filter(Boolean).join('\n\n');
}

function renderFinalThreadReply_(item) {
  const payload = getPayload_(item);
  return htmlToSlackText_(payload.message_title_html || payload.message_title || payload.subject || buildFlowSubject_(item, payload)).trim();
}

function htmlToSlackText_(html) {
  const source = String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  if (!source) return '';

  const listStack = [];
  const spanFormatStack = [];
  let output = '';
  const tokens = source.match(/<[^>]+>|[^<]+/g) || [];

  tokens.forEach(token => {
    if (token.charAt(0) !== '<') {
      output += decodeHtmlEntities_(token);
      return;
    }

    const tagName = getHtmlTagName_(token);
    if (!tagName) return;
    const closing = /^<\s*\//.test(token);
    const selfClosing = /\/\s*>$/.test(token);

    if (tagName === 'br') {
      output = appendSlackNewline_(output, 1);
      return;
    }

    if (tagName === 'img' && !closing) {
      output += decodeHtmlEntities_(getHtmlAttribute_(token, 'alt') || getHtmlAttribute_(token, 'title'));
      return;
    }

    if (tagName === 'p' || tagName === 'div') {
      if (closing) output = appendSlackNewline_(output, 2);
      return;
    }

    if (tagName === 'span') {
      if (closing) {
        output += spanFormatStack.pop() || '';
      } else {
        const style = getHtmlAttribute_(token, 'style').toLowerCase();
        let opener = '';
        let closer = '';
        if (/font-weight\s*:\s*(bold|[6-9]00)/.test(style)) {
          opener += '*';
          closer = '*' + closer;
        }
        if (/font-style\s*:\s*italic/.test(style)) {
          opener += '_';
          closer = '_' + closer;
        }
        output += opener;
        spanFormatStack.push(closer);
        if (selfClosing) output += spanFormatStack.pop() || '';
      }
      return;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      if (closing) {
        listStack.pop();
        output = appendSlackNewline_(output, listStack.length ? 1 : 2);
      } else {
        listStack.push({ type: tagName, count: 0 });
        output = appendSlackNewline_(output, 1);
      }
      return;
    }

    if (tagName === 'li') {
      if (closing) return;
      output = appendSlackNewline_(output, 1);
      output += buildSlackListPrefix_(listStack);
      return;
    }

    if (tagName === 'strong' || tagName === 'b') {
      output += '*';
      return;
    }

    if (tagName === 'em' || tagName === 'i') {
      output += '_';
      return;
    }

    if (tagName === 'a') {
      if (closing) {
        output += '>';
      } else {
        output += '<' + decodeHtmlEntities_(getHtmlAttribute_(token, 'href')) + '|';
        if (selfClosing) output += '>';
      }
    }
  });

  return output
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function appendSlackNewline_(text, count) {
  const desired = count || 1;
  const current = (String(text || '').match(/\n*$/) || [''])[0].length;
  if (current >= desired) return text;
  return text + new Array(desired - current + 1).join('\n');
}

function buildSlackListPrefix_(listStack) {
  const depth = Math.max(0, listStack.length - 1);
  const current = listStack.length ? listStack[listStack.length - 1] : null;
  const indent = new Array(depth + 1).join('  ');
  if (!current || current.type !== 'ol') return indent + '- ';
  current.count += 1;
  return indent + current.count + '. ';
}

function getHtmlTagName_(tag) {
  const match = String(tag || '').match(/^<\s*\/?\s*([a-z0-9]+)/i);
  return match ? match[1].toLowerCase() : '';
}

function getHtmlAttribute_(tag, attributeName) {
  const pattern = new RegExp(attributeName + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", 'i');
  const match = String(tag || '').match(pattern);
  return match ? (match[2] || match[3] || match[4] || '') : '';
}

function stripHtml_(html) {
  return decodeHtmlEntities_(String(html || '').replace(/<[^>]+>/g, '')).trim();
}

function decodeHtmlEntities_(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function buildTemplatePayload_(item) {
  const payload = Object.assign({}, item, getPayload_(item));
  if (payload.what && !payload.What) payload.What = payload.what;
  if (payload.so_what && !payload.why) payload.why = payload.so_what;
  if (payload.so_what && !payload['So What']) payload['So What'] = payload.so_what;
  if (payload.whats_next && !payload.next) payload.next = payload.whats_next;
  if (payload.whats_next && !payload['What\'s Next']) payload['What\'s Next'] = payload.whats_next;
  if (payload.subject && !payload.Subject) payload.Subject = payload.subject;
  if (payload.owner && !payload.Owner) payload.Owner = payload.owner;
  return payload;
}

function getPayload_(item) {
  return normalizePayload_(item);
}

function shouldReplyInThread_(template, item) {
  const policy = normalizeTemplatePolicy_(template['Thread Reply Policy']);
  if (policy === 'no reply' || policy === 'none') return false;
  if (policy === 'always reply' || policy === 'reply in thread') return true;
  return String(template['Post Mode'] || '').trim() === 'Reply In Thread';
}

function shouldCreateAnchorMessage_(template, item) {
  const policy = normalizeTemplatePolicy_(template['Anchor Update Policy']);
  if (policy === 'no anchor' || policy === 'none') return false;
  return true;
}

function shouldUpdateAnchorMessage_(template, item) {
  const policy = normalizeTemplatePolicy_(template['Anchor Update Policy']);
  if (policy === 'keep anchor' || policy === 'create anchor only' || policy === 'no anchor' || policy === 'none') return false;
  if (policy === 'create and update anchor' || policy === 'update anchor') return true;
  return true;
}

function shouldBroadcastThreadReply_(template, item) {
  return String(template['Reply Broadcast'] || '').toUpperCase() === 'TRUE';
}

function getTemplateAnchorText_(template) {
  return template['Anchor Text'] || template.Text || '';
}

function getTemplateReplyText_(template) {
  return template['Reply Text'] || '';
}

function normalizeTemplatePolicy_(value) {
  return String(value || '').trim().toLowerCase();
}

function validateRequiredTemplateVariables_(template, item) {
  if (hasFinalMessageOverride_(item)) return true;

  const payload = Object.assign({}, getPayload_(item), item);
  const templateKey = template['Template Key'];
  const variableRows = getRegistryObjects_('Template_Variables')
    .filter(row => String(row.Active || 'TRUE').toUpperCase() !== 'FALSE');
  const universalRows = variableRows.filter(isUniversalTemplateVariableRow_);
  const scopedRows = variableRows.filter(row => String(row['Template Key'] || '') === String(templateKey));
  const required = (universalRows.length ? universalRows : scopedRows).filter(row =>
    String(row.Required || '').toUpperCase() === 'TRUE'
  );
  const missing = required
    .map(row => row['Variable Key'])
    .filter(key => payload[key] == null || payload[key] === '');

  if (missing.length) {
    logHub_('ERROR', 'validateRequiredTemplateVariables_', item['Queue ID'], 'Missing required template variables.', {
      templateKey: templateKey,
      missing: missing
    });
    throw new Error('Missing required template variables: ' + missing.join(', '));
  }
}

function isUniversalTemplateVariableRow_(row) {
  if (!Object.prototype.hasOwnProperty.call(row, 'Template Key')) return true;
  const scope = String(row['Template Key'] || '').trim().toLowerCase();
  return !scope || scope === '*' || scope === 'all' || scope === 'universal';
}

function resolveDefaultChannel_(channelType) {
  const settingKey = buildChannelSettingKey_(channelType);
  const registryChannel = getRegistrySetting_(settingKey);
  if (registryChannel) {
    logHub_('INFO', 'resolveDefaultChannel_', '', 'Resolved Slack channel from Registry Settings.', {
      channelType: channelType,
      settingKey: settingKey
    });
    return registryChannel;
  }

  throw new Error('No Slack channel configured in Registry Settings for Channel Type: ' + channelType + ' (expected setting: ' + settingKey + ')');
}

function buildChannelSettingKey_(channelType) {
  const normalized = String(channelType || 'PROJECT').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return 'DEFAULT_' + normalized + '_CHANNEL';
}

function findRegistryRow_(sheetName, keyField, keyValue) {
  return getRegistryObjects_(sheetName).find(row => String(row[keyField]) === String(keyValue));
}

function getRegistrySetting_(key) {
  const setting = findRegistryRow_('Settings', 'Key', key);
  return setting ? setting.Value : '';
}

function getRegistryObjects_(sheetName) {
  const cachedRows = getCachedRegistryObjects_(sheetName);
  if (cachedRows) return cachedRows;

  const registry = getRegistrySpreadsheet_();
  const sheet = registry.getSheetByName(sheetName);
  if (!sheet) throw new Error('Registry sheet is missing: ' + sheetName);
  const rows = getObjects_(sheet);
  setCachedRegistryObjects_(sheetName, rows);
  return cloneRegistryRows_(rows);
}

function getRegistrySpreadsheet_() {
  const id = getScriptProperty_('REGISTRY_SPREADSHEET_ID');
  if (!id) throw new Error('Missing REGISTRY_SPREADSHEET_ID script property.');
  if (HUB_REGISTRY_SPREADSHEET_CACHE_ && HUB_REGISTRY_SPREADSHEET_ID_CACHE_ === id) {
    return HUB_REGISTRY_SPREADSHEET_CACHE_;
  }

  HUB_REGISTRY_SPREADSHEET_ID_CACHE_ = id;
  HUB_REGISTRY_SPREADSHEET_CACHE_ = SpreadsheetApp.openById(id);
  return HUB_REGISTRY_SPREADSHEET_CACHE_;
}

function getCachedRegistryObjects_(sheetName) {
  if (!shouldCacheRegistrySheet_(sheetName)) return null;

  const cacheKey = buildRegistryRowsCacheKey_(sheetName);
  if (HUB_REGISTRY_ROWS_CACHE_[cacheKey]) {
    return cloneRegistryRows_(HUB_REGISTRY_ROWS_CACHE_[cacheKey]);
  }

  try {
    const raw = CacheService.getScriptCache().get(cacheKey);
    if (!raw) return null;
    const rows = JSON.parse(raw);
    HUB_REGISTRY_ROWS_CACHE_[cacheKey] = rows;
    return cloneRegistryRows_(rows);
  } catch (error) {
    return null;
  }
}

function setCachedRegistryObjects_(sheetName, rows) {
  if (!shouldCacheRegistrySheet_(sheetName)) return;

  const cacheKey = buildRegistryRowsCacheKey_(sheetName);
  HUB_REGISTRY_ROWS_CACHE_[cacheKey] = cloneRegistryRows_(rows);

  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(rows), HUB_REGISTRY_CACHE_TTL_SECONDS_);
  } catch (error) {
    // Cache is an optimization only. Ignore quota/size failures.
  }
}

function shouldCacheRegistrySheet_(sheetName) {
  return HUB_REGISTRY_CACHEABLE_SHEETS_.indexOf(sheetName) >= 0;
}

function buildRegistryRowsCacheKey_(sheetName) {
  const id = getScriptProperty_('REGISTRY_SPREADSHEET_ID') || '';
  return 'hub-registry-rows:' + id + ':' + sheetName;
}

function cloneRegistryRows_(rows) {
  return (rows || []).map(row => Object.assign({}, row));
}

function clearHubRegistryCache() {
  HUB_REGISTRY_ROWS_CACHE_ = {};
  HUB_REGISTRY_CACHEABLE_SHEETS_.forEach(sheetName => {
    try {
      CacheService.getScriptCache().remove(buildRegistryRowsCacheKey_(sheetName));
    } catch (error) {
      // Cache clearing is best-effort.
    }
  });
  const message = 'Registry cache refreshed.';
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    // This function can also run outside spreadsheet UI contexts.
  }
  return message;
}
