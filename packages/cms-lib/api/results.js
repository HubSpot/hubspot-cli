const http = require('../http');

const RESULTS_API_PATH = 'cms/v3/functions/results';

async function getFunctionLogs(accountId, functionId, query = {}) {
  const { limit = 5 } = query;

  return http.get(accountId, {
    uri: `${RESULTS_API_PATH}/${functionId}`,
    query: {
      limit,
    },
  });
}

async function getLatestFunctionLog(accountId, functionId) {
  return http.get(accountId, {
    uri: `${RESULTS_API_PATH}/${functionId}/latest`,
  });
}

module.exports = {
  getFunctionLogs,
  getLatestFunctionLog,
};
