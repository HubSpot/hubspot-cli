const http = require('../http');

const RESULTS_API_PATH = 'cms/v3/functions/results';

async function getFunctionLogs(portalId, functionId, query = {}) {
  const { after: createdAfter, before: createdBefore, limit = 10 } = query;

  return http.get(portalId, {
    uri: `${RESULTS_API_PATH}/${functionId}`,
    query: {
      // createdAfter: '2020-07-31T18:14:32.203Z',
      createdAfter,
      createdBefore,
      limit,
      // sort param sorts by the function property name,
      // should be 'createdAt' by default -- test if we
      // need to explicitly pass this once limit and sort
      // are fixed
      sort: 'createdAt',
    },
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
