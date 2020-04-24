import * as http from '../http';

const DESIGN_MANAGER_API_PATH = 'designmanager/v1';

/**
 * @async
 * @param {number} portalId
 * @returns {Promise}
 */
export async function fetchMenus(portalId, query = {}) {
  return http.get(portalId, {
    uri: `${DESIGN_MANAGER_API_PATH}/menus`,
    query,
  });
}

/**
 * @async
 * @param {number} portalId
 * @returns {Promise}
 */
export async function fetchBuiltinMapping(portalId) {
  return http.get(portalId, {
    uri: `${DESIGN_MANAGER_API_PATH}/widgets/builtin-mapping`,
  });
}
