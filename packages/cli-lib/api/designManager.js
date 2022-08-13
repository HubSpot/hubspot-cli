const http = require('../http');

const DESIGN_MANAGER_API_PATH = 'designmanager/v1';

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchMenus(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/menus`,
    query,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchThemes(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/themes/combined`,
    query,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchBuiltinMapping(accountId) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/widgets/builtin-mapping`,
  });
}

async function fetchRawAssetByPath(accountId, path) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/raw-assets/by-path/${path}?portalId=${accountId}`,
  });
}

module.exports = {
  fetchBuiltinMapping,
  fetchMenus,
  fetchRawAssetByPath,
  fetchThemes,
};
