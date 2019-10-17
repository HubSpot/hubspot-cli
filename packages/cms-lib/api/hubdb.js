const http = require('../http');
const HUBDB_API_PATH = 'hubdb/api/v2';

async function fetchTables(portalId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
  });
}

async function fetchRows(portalId, tableId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows`,
  });
}

module.exports = {
  fetchTables,
  fetchRows,
};
