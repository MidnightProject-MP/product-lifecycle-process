import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  console,
  logHub_: () => {}
});

vm.runInContext(fs.readFileSync('personal-assistant/google-apps-script/hub/Templates.gs', 'utf8'), context);

let registrySettings = {};
context.getRegistrySetting_ = key => registrySettings[key] || '';

registrySettings = {
  DEFAULT_PROJECT_CHANNEL: 'CDEFAULTPROJECT'
};
assert.equal(context.resolveTestChannel_('Project'), 'CDEFAULTPROJECT');

registrySettings = {
  DEFAULT_PROJECT_CHANNEL: 'CDEFAULTPROJECT',
  TEST_PROJECT_CHANNEL: 'CTESTPROJECT'
};
assert.equal(context.resolveTestChannel_('Project'), 'CTESTPROJECT');

let scriptProperties = {};
context.getScriptProperty_ = key => scriptProperties[key] || '';
vm.runInContext(fs.readFileSync('personal-assistant/google-apps-script/hub/Graph.gs', 'utf8'), context);

assert.equal(context.isGraphMemoryEnabled_(), false);
scriptProperties = { ENABLE_PASSIVE_GRAPH_MEMORY: 'TRUE' };
assert.equal(context.isGraphMemoryEnabled_(), true);

console.log('Hub test-routing tests passed.');
