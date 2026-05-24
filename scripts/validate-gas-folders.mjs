import fs from 'node:fs';
import path from 'node:path';

const strictScriptIds = process.argv.includes('--strict-script-ids');
const folders = [
  'personal-assistant/google-apps-script/control-center',
  'personal-assistant/google-apps-script/hub',
  'personal-assistant/google-apps-script/registry',
  'personal-assistant/google-apps-script/automation',
  'personal-assistant/google-apps-script/dashboard',
];

let failed = false;

for (const folder of folders) {
  const errors = validateFolder(folder);
  if (errors.length) {
    failed = true;
    for (const error of errors) {
      console.error(`${folder}: ${error}`);
    }
  } else {
    console.log(`${folder}: ok`);
  }
}

if (failed) {
  process.exit(1);
}

function validateFolder(folder) {
  const errors = [];
  const claspPath = path.join(folder, '.clasp.json');
  const manifestPath = path.join(folder, 'appsscript.json');

  if (!fs.existsSync(folder)) {
    return ['folder is missing'];
  }

  const gsFiles = fs.readdirSync(folder).filter(file => file.endsWith('.gs'));
  if (!gsFiles.length) {
    errors.push('at least one .gs file is required');
  }

  const clasp = readJson(claspPath, errors);
  if (clasp) {
    if (!clasp.scriptId || typeof clasp.scriptId !== 'string') {
      errors.push('.clasp.json must contain a string scriptId');
    } else if (strictScriptIds && clasp.scriptId.startsWith('REPLACE_WITH_')) {
      errors.push('.clasp.json still contains a placeholder scriptId');
    }

    if (clasp.rootDir !== '.') {
      errors.push('.clasp.json rootDir must be "." for per-folder deployment');
    }
  }

  const manifest = readJson(manifestPath, errors);
  if (manifest) {
    if (manifest.runtimeVersion !== 'V8') {
      errors.push('appsscript.json runtimeVersion must be V8');
    }
    if (manifest.exceptionLogging !== 'STACKDRIVER') {
      errors.push('appsscript.json exceptionLogging must be STACKDRIVER');
    }
    if (manifest.timeZone !== 'America/Los_Angeles') {
      errors.push('appsscript.json timeZone must be America/Los_Angeles');
    }
  }

  return errors;
}

function readJson(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${path.basename(filePath)} is missing`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${path.basename(filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}
