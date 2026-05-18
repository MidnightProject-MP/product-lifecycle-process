const DASHBOARD = {
  SHEETS: {
    PROJECTS: 'Projects',
    RELEASES: 'Releases'
  },
  PROJECT_HEADERS: [
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
  RELEASE_HEADERS: [
    'Release ID',
    'Release Name',
    'Release Owner',
    'Status',
    'Planned Start',
    'Actual Start',
    'Completed At',
    'Rollback Status',
    'Included Projects',
    'Included Bugs',
    'Included Stray Stories',
    'Known Issues',
    'Go / No-Go Required',
    'Decision Owner',
    'Primary Channel',
    'Slack Thread ID',
    'Last Communication Triggered At'
  ],
  PROJECT_WATCHED_FIELDS: [
    'Status',
    'Current Phase',
    'Confidence of Owner (1-10)',
    'IT Risk Level',
    'Primary Risk',
    'Next Major Gate',
    'Next Gate ETA',
    'User Exposure'
  ],
  RELEASE_WATCHED_FIELDS: [
    'Status',
    'Planned Start',
    'Actual Start',
    'Completed At',
    'Rollback Status',
    'Known Issues',
    'Go / No-Go Required'
  ],
  SOURCE_ID_PROPERTIES: [
    'LEADERSHIP_SPREADSHEET_ID',
    'EXECUTIVE_DASHBOARD_SPREADSHEET_ID'
  ]
};

function dashboardNowIso_() {
  return new Date().toISOString();
}

function getDashboardScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getDashboardSourceSpreadsheetId_() {
  for (let i = 0; i < DASHBOARD.SOURCE_ID_PROPERTIES.length; i++) {
    const value = getDashboardScriptProperty_(DASHBOARD.SOURCE_ID_PROPERTIES[i]);
    if (value) return value;
  }
  return '';
}
