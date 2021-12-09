const http = require('../http');
const APP_PIPELINE_API_PATH = '/app-pipeline/v1';

async function deployApp(accountId, appFolderPath) {
  return http.post(accountId, {
    url: `${APP_PIPELINE_API_PATH}/deploy/async`,
    data: {
      appPath: appFolderPath,
    },
  });
}

async function deployAppSync(accountId, appFolderPath) {
  return http.post(accountId, {
    url: `${APP_PIPELINE_API_PATH}/deploy/sync`,
    timeout: 60000,
    data: {
      appPath: appFolderPath,
    },
  });
}

module.exports = {
  deployAppSync,
  deployApp,
};
