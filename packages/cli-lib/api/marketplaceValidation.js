const http = require('../http');

const VALIDATION_API_BASE = 'quality-engine/v1/validation';

/**
 * @param {number} accountId
 * @returns {Promise}
 */
function requestValidation(accountId, body = {}) {
  return http.post(accountId, {
    uri: `${VALIDATION_API_BASE}/request`,
    body,
  });
}

/**
 * @param {number} accountId
 * @returns {Promise}
 */
function getValidationStatus(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${VALIDATION_API_BASE}/status`,
    query,
  });
}

/**
 * @param {number} accountId
 * @returns {Promise}
 */
function getValidationResults(accountId, query = {}) {
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
