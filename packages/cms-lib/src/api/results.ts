import * as http from '../http';

const RESULTS_API_PATH = 'cms/v3/functions/results';

export async function getFunctionLogs(portalId, functionId, query) {
  return http.get(portalId, {
    uri: `${RESULTS_API_PATH}/${functionId}`,
    query,
  });
}

export async function getLatestFunctionLog(portalId, functionId) {
  return http.get(portalId, {
    uri: `${RESULTS_API_PATH}/${functionId}/latest`,
  });
}
