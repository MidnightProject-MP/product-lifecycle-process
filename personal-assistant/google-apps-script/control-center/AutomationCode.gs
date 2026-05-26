function onOpenAutomationLegacy_() {
  SpreadsheetApp.getUi()
    .createMenu('Communication Automation')
    .addItem('Setup sheets', 'setupAutomationSheets')
    .addSeparator()
    .addItem('Enable sandbox draft creation', 'enableAutomationSandboxDraftCreation')
    .addItem('Disable draft creation', 'disableAutomationDraftCreation')
    .addSeparator()
    .addItem('Validate export', 'showAutomationExportValidation')
    .addItem('Run dashboard sync', 'showAutomationSyncResult')
    .addToUi();
}

function setupAutomationSheets() {
  const ss = SpreadsheetApp.getActive();

  ensureAutomationRawSheet_(ss, AUTOMATION.SHEETS.RAW_PROJECTS);
  ensureAutomationRawSheet_(ss, AUTOMATION.SHEETS.RAW_RELEASES);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.EXPORT_SOURCE, AUTOMATION.HEADERS.EXPORT);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.EXPORT, AUTOMATION.HEADERS.EXPORT);
  ensureAutomationChangeIndexSheet_(ss);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS, AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.DASHBOARD_CHANGES, AUTOMATION.HEADERS.DASHBOARD_CHANGES);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS, AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS);
  ensureAutomationSheet_(ss, AUTOMATION.SHEETS.TRIGGER_LOG, AUTOMATION.HEADERS.TRIGGER_LOG);

  const config = ensureAutomationSheet_(ss, AUTOMATION.SHEETS.CONFIG, AUTOMATION.HEADERS.CONFIG);
  seedAutomationConfig_(config);
}

function syncLeadershipDashboardToAutomation() {
  const startedAt = new Date().getTime();
  const timings = {};
  let checkpoint = new Date().getTime();
  setupAutomationSheets();
  timings.setupMs = new Date().getTime() - checkpoint;

  const automation = SpreadsheetApp.getActive();
  checkpoint = new Date().getTime();
  const config = getAutomationConfig_();
  const pollCount = incrementAutomationPollCount_(automation, config);
  config.POLL_COUNT = String(pollCount);
  timings.configMs = new Date().getTime() - checkpoint;

  checkpoint = new Date().getTime();
  const fastPreflight = buildAutomationFastChangePreflight_(automation, config);
  timings.fastIndexMs = new Date().getTime() - checkpoint;

  if (fastPreflight.mode === 'Fast Skip') {
    checkpoint = new Date().getTime();
    const gc = runAutomationGarbageCollectionIfNeeded_(automation, config);
    timings.gcMs = new Date().getTime() - checkpoint;
    const configUpdates = {
      LAST_FAST_CHECK_AT: automationNowIso_(),
      LAST_SYNC_MODE: 'Fast Skip'
    };
    if (gc && gc.ran && gc.lastGcAt) configUpdates.LAST_GC_AT = gc.lastGcAt;
    checkpoint = new Date().getTime();
    batchUpdateAutomationConfigValues_(automation, configUpdates);
    timings.configWriteMs = new Date().getTime() - checkpoint;
    return {
      ok: true,
      pollCount: pollCount,
      syncMode: 'Fast Skip',
      message: 'No source changes detected.',
      changeIndexRows: fastPreflight.rowCount,
      pendingEvaluations: 0,
      garbageCollection: gc,
      timings: timings,
      durationMs: new Date().getTime() - startedAt
    };
  }

  checkpoint = new Date().getTime();
  const materialized = materializeAutomationExportIfValid_(automation, config);
  timings.materializeMs = new Date().getTime() - checkpoint;

  if (!materialized.ok) {
    batchUpdateAutomationConfigValues_(automation, {
      LAST_SYNC_MODE: 'Circuit Breaker'
    });
    recordAutomationTriggerLog_(automation, {
      'Work Item Type': 'Automation Export',
      'Flow ID': '',
      'Source Row Key': '',
      'Trigger Candidate': 'Circuit breaker blocked export materialization',
      'Event Key': '',
      'Old State Hash': '',
      'New State Hash': '',
      'Old State Summary': '',
      'New State Summary': materialized.message,
      'Dedupe Key': '',
      'Hub Queue ID': '',
      'Processing Status': 'Skipped - Circuit Breaker',
      'Processed At': automationNowIso_(),
      'Processing Error': materialized.message
    });
    return {
      ok: false,
      pollCount: pollCount,
      message: materialized.message,
      timings: timings,
      durationMs: new Date().getTime() - startedAt
    };
  }

  checkpoint = new Date().getTime();
  const rows = readAutomationExportRows_(automation);
  timings.readExportMs = new Date().getTime() - checkpoint;
  checkpoint = new Date().getTime();
  const result = processAutomationExportRows_(automation, config, rows, {
    observationRows: fastPreflight.observationRows || null
  });
  timings.processMs = new Date().getTime() - checkpoint;
  checkpoint = new Date().getTime();
  const gc = runAutomationGarbageCollectionIfNeeded_(automation, config);
  timings.gcMs = new Date().getTime() - checkpoint;
  const fullSyncMode = result.errors ? 'Full Error' : 'Full';
  const configUpdates = {
    LAST_SYNC_MODE: fullSyncMode
  };
  if (!result.errors && fastPreflight.indexHealthy && fastPreflight.hash) {
    configUpdates.LAST_CHANGE_INDEX_HASH = fastPreflight.hash;
    configUpdates.LAST_CHANGE_INDEX_AT = automationNowIso_();
  }
  if (gc && gc.ran && gc.lastGcAt) configUpdates.LAST_GC_AT = gc.lastGcAt;
  checkpoint = new Date().getTime();
  batchUpdateAutomationConfigValues_(automation, configUpdates);
  timings.configWriteMs = new Date().getTime() - checkpoint;

  return {
    ok: true,
    pollCount: pollCount,
    syncMode: fullSyncMode,
    fastPreflightReason: fastPreflight.reason,
    changeIndexRows: fastPreflight.rowCount || 0,
    materializedRows: materialized.rowCount,
    processedRows: result.processedRows,
    changedRows: result.changedRows,
    hubDraftsCreated: result.hubDraftsCreated,
    pendingEvaluations: result.pendingEvaluations,
    skippedRows: result.skippedRows,
    errors: result.errors,
    garbageCollection: gc,
    timings: timings,
    durationMs: new Date().getTime() - startedAt
  };
}

function materializeAutomationExport() {
  setupAutomationSheets();
  return materializeAutomationExportIfValid_(SpreadsheetApp.getActive(), getAutomationConfig_());
}

function debugValidateAutomationExport() {
  setupAutomationSheets();
  const validation = validateAutomationExportSource_(SpreadsheetApp.getActive(), getAutomationConfig_());
  return JSON.stringify(validation, null, 2);
}

function enableAutomationSandboxDraftCreation() {
  setupAutomationSheets();
  const ss = SpreadsheetApp.getActive();
  updateAutomationConfigValue_(ss, 'CREATE_HUB_DRAFTS', 'TRUE');
  updateAutomationConfigValue_(ss, 'DASHBOARD_STABLE_POLLS', '2');
  updateAutomationConfigValue_(ss, 'REQUIRE_PROJECT_PRIMARY_RISK', 'TRUE');
  const result = buildAutomationConfigSummary_(getAutomationConfig_());
  showAutomationUiMessage_('Sandbox draft creation enabled', result);
  return JSON.stringify(result, null, 2);
}

function disableAutomationDraftCreation() {
  setupAutomationSheets();
  const ss = SpreadsheetApp.getActive();
  updateAutomationConfigValue_(ss, 'CREATE_HUB_DRAFTS', 'FALSE');
  const result = buildAutomationConfigSummary_(getAutomationConfig_());
  showAutomationUiMessage_('Dashboard draft creation disabled', result);
  return JSON.stringify(result, null, 2);
}

function showAutomationExportValidation() {
  const validation = JSON.parse(debugValidateAutomationExport());
  showAutomationUiMessage_(validation.ok ? 'Automation export is valid' : 'Automation export validation failed', {
    ok: validation.ok,
    message: validation.message,
    rowCount: validation.rows ? validation.rows.length : 0
  });
  return JSON.stringify(validation, null, 2);
}

function showAutomationSyncResult() {
  const result = syncLeadershipDashboardToAutomation();
  showAutomationUiMessage_(result.ok ? 'Dashboard sync completed' : 'Dashboard sync stopped', result);
  return JSON.stringify(result, null, 2);
}

function resetAutomationShadowEvidenceForDev() {
  setupAutomationSheets();
  const ss = SpreadsheetApp.getActive();
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.EXPORT), AUTOMATION.HEADERS.EXPORT);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_SNAPSHOTS), AUTOMATION.HEADERS.DASHBOARD_SNAPSHOTS);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_CHANGES), AUTOMATION.HEADERS.DASHBOARD_CHANGES);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.DASHBOARD_OBSERVATIONS), AUTOMATION.HEADERS.DASHBOARD_OBSERVATIONS);
  resetAutomationSheet_(ss.getSheetByName(AUTOMATION.SHEETS.TRIGGER_LOG), AUTOMATION.HEADERS.TRIGGER_LOG);
  updateAutomationConfigValue_(ss, 'POLL_COUNT', '0');
  updateAutomationConfigValue_(ss, 'LAST_GC_AT', '');
  updateAutomationConfigValue_(ss, 'LAST_CHANGE_INDEX_HASH', '');
  updateAutomationConfigValue_(ss, 'LAST_CHANGE_INDEX_AT', '');
  updateAutomationConfigValue_(ss, 'LAST_FAST_CHECK_AT', '');
  updateAutomationConfigValue_(ss, 'LAST_SYNC_MODE', '');
  updateAutomationConfigValue_(ss, 'CREATE_HUB_DRAFTS', 'FALSE');
  return {
    ok: true,
    message: 'Automation shadow evidence reset. CREATE_HUB_DRAFTS is FALSE.'
  };
}
