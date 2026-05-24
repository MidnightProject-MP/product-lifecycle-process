import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const context = vm.createContext({ console });
const automationDir = 'personal-assistant/google-apps-script/automation';
vm.runInContext(fs.readFileSync(path.join(automationDir, 'Config.gs'), 'utf8'), context);
for (const file of fs.readdirSync(automationDir).filter(name => name.endsWith('.gs') && name !== 'Config.gs').sort()) {
  vm.runInContext(fs.readFileSync(path.join(automationDir, file), 'utf8'), context);
}

function trigger(row, oldState, changes) {
  return JSON.parse(JSON.stringify(context.inferAutomationExportTrigger_(row, oldState, changes)));
}

assert.deepEqual(
  trigger({ 'Record Type': 'Project', Status: '🟡' }, { Status: '🟢' }, [{ field: 'Status', oldValue: '🟢', newValue: '🟡' }]),
  { candidate: 'Material project status change', eventKey: 'project.unexpected_status_change' }
);

assert.deepEqual(
  trigger({ 'Record Type': 'Project', Status: '🟢' }, { Status: '🔴' }, [{ field: 'Status', oldValue: '🔴', newValue: '🟢' }]),
  { candidate: 'Project back on track', eventKey: 'project.unexpected_status_change' }
);

assert.deepEqual(
  trigger({ 'Record Type': 'Project', 'Next Gate ETA': '2026-06-15' }, { 'Next Gate ETA': '2026-06-01' }, [{ field: 'Next Gate ETA', oldValue: '2026-06-01', newValue: '2026-06-15' }]),
  { candidate: 'Project next gate ETA changed', eventKey: 'project.unexpected_status_change' }
);

assert.deepEqual(
  trigger({ 'Record Type': 'Project', 'Primary Target': 'US Rollout' }, { 'Primary Target': 'Beta' }, [{ field: 'Primary Target', oldValue: 'Beta', newValue: 'US Rollout' }]),
  { candidate: 'Project primary target changed', eventKey: 'project.unexpected_status_change' }
);

assert.deepEqual(
  trigger(
    { 'Record Type': 'Project', Phase: 'Development', 'Next Gate': 'Beta', 'Next Gate ETA': '2026-06-15' },
    { Phase: 'Requirements', 'Next Gate': 'MVP', 'Next Gate ETA': '2026-06-01' },
    [
      { field: 'Phase', oldValue: 'Requirements', newValue: 'Development' },
      { field: 'Next Gate', oldValue: 'MVP', newValue: 'Beta' },
      { field: 'Next Gate ETA', oldValue: '2026-06-01', newValue: '2026-06-15' }
    ]
  ),
  { candidate: 'Project gate cleared', eventKey: 'project.gate_passed' }
);

assert.deepEqual(
  trigger(
    { 'Record Type': 'Project', Phase: 'Intl Rollout', 'Next Gate': 'Closeout', 'Next Gate ETA': '2026-07-01', 'Primary Target': 'US Rollout' },
    { Phase: 'Beta', 'Next Gate': 'US Rollout', 'Next Gate ETA': '2026-06-01', 'Primary Target': 'US Rollout' },
    [
      { field: 'Phase', oldValue: 'Beta', newValue: 'Intl Rollout' },
      { field: 'Next Gate', oldValue: 'US Rollout', newValue: 'Closeout' },
      { field: 'Next Gate ETA', oldValue: '2026-06-01', newValue: '2026-07-01' }
    ]
  ),
  { candidate: 'Project primary target cleared', eventKey: 'project.completed' }
);

assert.deepEqual(
  trigger(
    { 'Record Type': 'Project', 'Next Gate': 'Special Release', 'Next Gate ETA': '2026-05-27' },
    { 'Next Gate': 'Beta', 'Next Gate ETA': '2026-06-01' },
    [
      { field: 'Next Gate', oldValue: 'Beta', newValue: 'Special Release' },
      { field: 'Next Gate ETA', oldValue: '2026-06-01', newValue: '2026-05-27' }
    ]
  ),
  { candidate: 'Special release scheduled', eventKey: 'release.scheduled' }
);

assert.deepEqual(
  trigger({ 'Record Type': 'Release', 'Release Date': '2026-10-11' }, { 'Release Date': '2026-10-13' }, [{ field: 'Release Date', oldValue: '2026-10-13', newValue: '2026-10-11' }]),
  { candidate: 'Release schedule changed', eventKey: 'release.scheduled' }
);

assert.deepEqual(
  trigger({ 'Record Type': 'Release', 'Release Status': 'Completed' }, { 'Release Status': 'Started' }, [{ field: 'Release Status', oldValue: 'Started', newValue: 'Completed' }]),
  { candidate: 'Release lifecycle state changed', eventKey: 'release.completed' }
);

console.log('Dashboard trigger-rule tests passed.');
