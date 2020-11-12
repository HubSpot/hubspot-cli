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

async function buildPackage(portalId, path) {
  return http.post(portalId, {
    uri: `${FUNCTION_API_PATH}/package`,
    body: {
      path,
    },
  });
}

module.exports = {
  buildPackage,
  getFunctionByPath,
  getRoutes,
};
