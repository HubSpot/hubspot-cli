const http = require('../http');
const APP_PIPELINE_API_PATH = '/app-pipeline/v1';

async function deployApp(accountId, appFolderPath) {
  return http.post(accountId, {
    uri: `${APP_PIPELINE_API_PATH}/deploy/async`,
    body: {
      appPath: appFolderPath,
    },
  });
}

module.exports = {
  deployApp,
};
