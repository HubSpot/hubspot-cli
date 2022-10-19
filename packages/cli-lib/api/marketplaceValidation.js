const http = require('../http');

const VALIDATION_API_BASE = 'quality-engine/v1/validation';

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function requestValidation(accountId, body = {}) {
  return http.post(accountId, {
    uri: `${VALIDATION_API_BASE}/request`,
    body,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function getValidationStatus(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${VALIDATION_API_BASE}/status`,
    query,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function getValidationResults(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${VALIDATION_API_BASE}/results`,
    query,
  });
}

module.exports = {
  requestValidation,
  getValidationStatus,
  getValidationResults,
};
