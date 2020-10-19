const http = require('../http');

const FUNCTION_API_PATH = 'cms/v3/functions';

async function getFunctionByPath(portalId, functionPath) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/function/by-path/${functionPath}`,
  });
}

async function getRoutes(portalId) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/routes`,
  });
}

module.exports = {
  getFunctionByPath,
  getRoutes,
};
