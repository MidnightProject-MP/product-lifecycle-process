const DASHBOARD = {
  SHEET_NAME: 'Projects',
  HEADERS: [
    'Project',
    'Lead PM',
    'Owner',
    'Current Phase',
    'User Exposure',
    'Progress %',
    'Status',
    'Confidence of Owner (1-10)',
    'IT Risk Level',
    'Primary Risk',
    'Next Major Gate',
    'Next Gate ETA',
    'Primary Target',
    'Last Communication Triggered At'
  ],
  WATCHED_FIELDS: [
    'Status',
    'Current Phase',
    'Confidence of Owner (1-10)',
    'IT Risk Level',
    'Primary Risk',
    'Next Major Gate',
    'Next Gate ETA',
    'User Exposure'
  ]
};

function dashboardNowIso_() {
  return new Date().toISOString();
}

function getDashboardScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

