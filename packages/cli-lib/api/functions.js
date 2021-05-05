const http = require('../http');
const FUNCTION_API_PATH = 'cms/v3/functions';

async function getFunctionByPath(accountId, functionPath) {
  return http.get(accountId, {
    uri: `${FUNCTION_API_PATH}/function/by-path/${functionPath}`,
  });
}

async function getRoutes(accountId) {
  return http.get(accountId, {
    uri: `${FUNCTION_API_PATH}/routes`,
  });
}

async function buildPackage(portalId, folderPath) {
  return http.post(portalId, {
    uri: `${FUNCTION_API_PATH}/build/async`,
    headers: {
      Accept: 'text/plain',
    },
    body: {
      folderPath,
    },
  });
}

async function getBuildStatus(portalId, buildId) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/build/${buildId}/poll`,
  });
}

module.exports = {
  buildPackage,
  getBuildStatus,
  getFunctionByPath,
  getRoutes,
};
