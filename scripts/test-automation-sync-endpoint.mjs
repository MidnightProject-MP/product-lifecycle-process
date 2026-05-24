import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function createContext(expectedToken = 'shared-secret') {
  const outputs = [];
  const context = vm.createContext({
    console,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return key === 'AUTOMATION_SYNC_TOKEN' ? expectedToken : '';
          }
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            outputs.push(this);
            return this;
          }
        };
        return output;
      }
    },
    syncLeadershipDashboardToAutomation() {
      return {
        ok: true,
        pollCount: 12,
        syncMode: 'Full',
        changedRows: 2,
        hubDraftsCreated: 1,
        pendingEvaluations: 1,
        skippedRows: 0,
        errors: 0,
        durationMs: 345
      };
    }
  });
  vm.runInContext(fs.readFileSync('personal-assistant/google-apps-script/automation/AutomationEndpoint.gs', 'utf8'), context);
  return { context, outputs };
}

function callEndpoint(context, body) {
  return context.doPost({
    postData: {
      contents: JSON.stringify(body)
    }
  });
}

{
  const { context } = createContext();
  const response = callEndpoint(context, { action: 'sync_dashboard', token: 'wrong' });
  const payload = JSON.parse(response.text);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /authorization failed/i);
}

{
  const { context } = createContext();
  const response = callEndpoint(context, { action: 'sync_dashboard', token: 'shared-secret' });
  const payload = JSON.parse(response.text);
  assert.equal(payload.ok, true);
  assert.equal(payload.syncMode, 'Full');
  assert.equal(payload.changedRows, 2);
  assert.equal(payload.hubDraftsCreated, 1);
  assert.equal(payload.pendingEvaluations, 1);
  assert.equal(response.mimeType, 'application/json');
}

{
  const { context } = createContext();
  const response = callEndpoint(context, { action: 'unknown', token: 'shared-secret' });
  const payload = JSON.parse(response.text);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /unsupported/i);
}

console.log('Automation sync endpoint tests passed.');
