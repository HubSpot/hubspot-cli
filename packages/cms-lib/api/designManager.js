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
async function fetchBuiltinMapping(accountId) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/widgets/builtin-mapping`,
  });
}

module.exports = {
  fetchBuiltinMapping,
  fetchMenus,
};
