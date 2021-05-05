import http from '../http';

const DESIGN_MANAGER_API_PATH = 'designmanager/v1';

async function fetchMenus(accountId: number, query = {}) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/menus`,
    query,
  });
}

async function fetchBuiltinMapping(accountId: number) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/widgets/builtin-mapping`,
  });
}

async function fetchRawAssetByPath(accountId: number, path: string) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/raw-assets/by-path/${path}?portalId=${accountId}`,
  });
}

export { fetchBuiltinMapping, fetchMenus, fetchRawAssetByPath };
