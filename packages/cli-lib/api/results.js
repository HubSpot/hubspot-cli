const http = require('../http');

const RESULTS_API_PATH = 'cms/v3/functions/results';

async function getFunctionLogs(accountId, route, query = {}) {
  const { limit = 5 } = query;

  return http.get(accountId, {
    url: `${RESULTS_API_PATH}/by-route/${route}`,
    params: { ...query, limit },
  });
}

async function getLatestFunctionLog(accountId, route) {
  return http.get(accountId, {
    url: `${RESULTS_API_PATH}/by-route/${route}/latest`,
  });
}

module.exports = {
  getFunctionLogs,
  getLatestFunctionLog,
};
