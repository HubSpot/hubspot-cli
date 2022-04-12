const http = require('../http');
const path = require('path');

const MARKETPLACE_TEMPLATE_API_PATH = 'product/marketplace/v2/template/render';
const MARKETPLACE_MODULE_API_PATH = 'product/marketplace/v2/module/render';

/**
 * @async
 * @param {number} accountId
 * @param {string} sourceCode
 * @param {object} hublValidationOptions
 * @returns {Promise}
 */
async function fetchTemplateDependencies(accountId, sourceCode) {
  return http.post(accountId, {
    uri: MARKETPLACE_TEMPLATE_API_PATH,
    body: { template_source: sourceCode },
  });
}

/**
 * @async
 * @param {number} accountId
 * @param {string} sourceCode
 * @param {object} hublValidationOptions
 * @returns {Promise}
 */
async function fetchModuleDependencies(accountId, relativePath) {
  return http.post(accountId, {
    uri: path.join(MARKETPLACE_MODULE_API_PATH, relativePath),
  });
}

module.exports = {
  fetchTemplateDependencies,
  fetchModuleDependencies,
};
