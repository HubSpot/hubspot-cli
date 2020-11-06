const http = require('../http');

const RESULTS_API_PATH = 'cms/v3/functions/results';

async function getFunctionLogs(portalId, functionId, query = {}) {
  const { limit = 5 } = query;

  return http.get(portalId, {
    uri: `${RESULTS_API_PATH}/${functionId}`,
    query: { ...query, limit },
  });
}

async function getLatestFunctionLog(portalId, functionId) {
  return http.get(portalId, {
    uri: `${RESULTS_API_PATH}/${functionId}/latest`,
  });
}

module.exports = {
  getFunctionLogs,
  getLatestFunctionLog,
};
