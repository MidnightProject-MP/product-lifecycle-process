import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  console
});

vm.runInContext(fs.readFileSync('personal-assistant/google-apps-script/control-center/Templates.gs', 'utf8'), context);

assert.equal(context.getSpotlightPolicy_({ 'Reply Broadcast': 'TRUE' }, {}), 'keep latest');
assert.equal(context.shouldPostSpotlightReply_({ 'Reply Broadcast': 'TRUE' }, {}), true);
assert.equal(context.shouldDeletePreviousSpotlightReply_({ 'Reply Broadcast': 'TRUE' }, {}), true);

assert.equal(context.getSpotlightPolicy_({ 'Reply Broadcast': 'FALSE' }, {}), 'none');
assert.equal(context.shouldPostSpotlightReply_({ 'Reply Broadcast': 'FALSE' }, {}), false);

assert.equal(context.shouldPostSpotlightReply_({ 'Spotlight Policy': 'Keep All' }, {}), true);
assert.equal(context.shouldDeletePreviousSpotlightReply_({ 'Spotlight Policy': 'Keep All' }, {}), false);

assert.equal(context.shouldPostSpotlightReply_({ 'Spotlight Policy': 'None', 'Reply Broadcast': 'TRUE' }, {}), false);

console.log('Slack spotlight policy tests passed.');
