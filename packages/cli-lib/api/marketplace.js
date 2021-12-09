const http = require('../http');

const MARKETPLACE_API_PATH = 'product/marketplace/v2/template/render';

/**
 * @async
 * @param {number} accountId
 * @param {string} sourceCode
 * @param {object} hublValidationOptions
 * @returns {Promise}
 */
async function fetchDependencies(accountId, sourceCode) {
  return http.post(accountId, {
    url: MARKETPLACE_API_PATH,
    data: { template_source: sourceCode },
  });
}

module.exports = {
  fetchDependencies,
};
