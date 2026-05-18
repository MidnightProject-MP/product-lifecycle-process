function findTemplate_(item) {
  const payload = getPayload_(item);
  const eventKey = item['Event Key'] || payload.event_key || payload.eventKey || '';
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

var HUB_REGISTRY_ROWS_CACHE_ = {};
var HUB_REGISTRY_SPREADSHEET_CACHE_ = null;
var HUB_REGISTRY_SPREADSHEET_ID_CACHE_ = '';
var HUB_REGISTRY_CACHEABLE_SHEETS_ = ['Settings', 'Event_Catalog', 'Templates', 'Template_Variables', 'Event_Transitions', 'Approval_Rules'];
var HUB_REGISTRY_CACHE_TTL_SECONDS_ = 300;

function renderTemplate_(text, item) {
  const payload = Object.assign({}, getPayload_(item), item);
  return String(text || '').replace(/\\n/g, '\n').replace(/\{\{([^}]+)\}\}/g, (_, token) => {
    const key = token.trim();
    return payload[key] == null ? '' : String(payload[key]);
  });
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
