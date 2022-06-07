const http = require('../http');

const LIGHTHOUSE_SCORE_API_BASE = 'lighthouse/v1';

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function getLighthouseScore(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${LIGHTHOUSE_SCORE_API_BASE}/score`,
    query,
  });
}

module.exports = {
  getLighthouseScore,
};
