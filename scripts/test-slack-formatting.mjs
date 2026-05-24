import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync('personal-assistant/google-apps-script/hub/Templates.gs', 'utf8'), context);

const render = html => context.htmlToSlackText_(html);

assert.equal(
  render('<p><strong>Release</strong> <em>ready</em></p>'),
  '*Release* _ready_'
);

assert.equal(
  render('<ul><li><strong>Status:</strong> 🟡 delayed</li><li><span style="font-weight: 700;">Risk:</span> fixes pending</li></ul>'),
  '- *Status:* 🟡 delayed\n- *Risk:* fixes pending'
);

assert.equal(
  render('<ol><li>First</li><li>Second<ul><li><em>Nested</em></li></ul></li></ol>'),
  '1. First\n2. Second\n  - _Nested_'
);

assert.equal(
  render('<p>See <a href="https://example.com/path?a=1&amp;b=2">details</a></p>'),
  'See <https://example.com/path?a=1&b=2|details>'
);

assert.equal(
  render('<p><img alt="🟢" src="status.png"> Back on track</p>'),
  '🟢 Back on track'
);

assert.equal(
  render('<ul><li><b>Status:</b> <img data-emoji="🟡" src="status.png"> delayed</li><li><strong>Owner:</strong> Philippe</li></ul>'),
  '- *Status:* 🟡 delayed\n- *Owner:* Philippe'
);

console.log('Slack formatting tests passed.');
