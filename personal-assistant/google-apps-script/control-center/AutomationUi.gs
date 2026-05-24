function buildAutomationConfigSummary_(config) {
  return {
    CREATE_HUB_DRAFTS: String(config.CREATE_HUB_DRAFTS || ''),
    DASHBOARD_STABLE_POLLS: String(config.DASHBOARD_STABLE_POLLS || ''),
    REQUIRE_PROJECT_PRIMARY_RISK: String(config.REQUIRE_PROJECT_PRIMARY_RISK || ''),
    FAST_CHANGE_INDEX_ENABLED: String(config.FAST_CHANGE_INDEX_ENABLED || ''),
    LAST_SYNC_MODE: String(config.LAST_SYNC_MODE || ''),
    CONTROL_CENTER_MODE: 'TRUE'
  };
}

function showAutomationUiMessage_(title, details) {
  const text = Object.keys(details || {}).map(key => key + ': ' + formatAutomationUiValue_(details[key])).join('\n');
  SpreadsheetApp.getUi().alert(title, text || 'Done.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function formatAutomationUiValue_(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
