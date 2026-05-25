import fs from 'node:fs';
import path from 'node:path';

const htmlFiles = [
  'personal-assistant/google-apps-script/control-center/CommunicationAppPage.html',
  'personal-assistant/google-apps-script/control-center/ReviewControllerSidebar.html'
];

for (const file of htmlFiles) {
  const absolute = path.resolve(file);
  const html = fs.readFileSync(absolute, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) {
    throw new Error(`${file}: no inline <script> block found`);
  }

  scripts.forEach((match, index) => {
    try {
      new Function(match[1]);
    } catch (error) {
      throw new Error(`${file} script ${index + 1} failed to parse: ${error.message}`);
    }
  });
}

console.log('GAS HTML script parse tests passed.');
