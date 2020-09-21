const http = require('../http');

const RESULTS_API_PATH = 'cms/v3/functions/results';

async function getFunctionLogs(portalId, functionId, query = {}) {
  const { after, before, limit, sort } = query;
  return http.get(portalId, {
    uri: `${RESULTS_API_PATH}/${functionId}`,
    query: { after, before, limit, sort },
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
