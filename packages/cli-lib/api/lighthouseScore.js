const http = require('../http');

const LIGHTHOUSE_SCORE_API_BASE = 'quality-engine/v1/lighthouse';

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function requestLighthouseScore(accountId, body = {}) {
  return http.post(accountId, {
    uri: `${LIGHTHOUSE_SCORE_API_BASE}/request`,
    body,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function getLighthouseScoreStatus(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${LIGHTHOUSE_SCORE_API_BASE}/status`,
    query,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function getLighthouseScore(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${LIGHTHOUSE_SCORE_API_BASE}/scores`,
    query,
  });
}

module.exports = {
  requestLighthouseScore,
  getLighthouseScoreStatus,
  getLighthouseScore,
};
