function doPost(e) {
  try {
    const request = parseAutomationEndpointRequest_(e);
    authorizeAutomationEndpointRequest_(request);

    if (request.action !== 'sync_dashboard') {
      return automationEndpointJsonResponse_({
        ok: false,
        message: 'Unsupported Automation endpoint action.'
      });
    }

    const result = syncLeadershipDashboardToAutomation();
    return automationEndpointJsonResponse_(buildAutomationEndpointSyncSummary_(result));
  } catch (error) {
    return automationEndpointJsonResponse_({
      ok: false,
      message: error.message || String(error)
    });
  }
}

function parseAutomationEndpointRequest_(e) {
  const body = e && e.postData && e.postData.contents ? String(e.postData.contents) : '{}';
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Automation endpoint received invalid JSON.');
  }
}

function authorizeAutomationEndpointRequest_(request) {
  const expected = PropertiesService.getScriptProperties().getProperty('AUTOMATION_SYNC_TOKEN');
  if (!expected) {
    throw new Error('Automation sync endpoint is not configured.');
  }
  if (!request || String(request.token || '') !== expected) {
    throw new Error('Automation sync endpoint authorization failed.');
  }
}

function buildAutomationEndpointSyncSummary_(result) {
  return {
    ok: result && result.ok !== false,
    message: result && result.message || '',
    pollCount: result && result.pollCount || 0,
    syncMode: result && result.syncMode || '',
    changedRows: result && result.changedRows || 0,
    hubDraftsCreated: result && result.hubDraftsCreated || 0,
    pendingEvaluations: result && result.pendingEvaluations || 0,
    skippedRows: result && result.skippedRows || 0,
    errors: result && result.errors || 0,
    durationMs: result && result.durationMs || 0
  };
}

function automationEndpointJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload || {}))
    .setMimeType(ContentService.MimeType.JSON);
}
