const http = require('../http');
const HUBDB_API_PATH = 'hubdb/api/v2';

async function fetchTables(portalId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
  });
}

async function createTable(portalId, schema) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
    body: schema,
  });
}

async function publishTable(portalId, tableId) {
  return http.put(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/publish`,
  });
}

async function updateRows(portalId, tableId, rows) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows/batch/update`,
    body: rows,
  });
}

async function createRows(portalId, tableId, rows) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows/batch/create`,
    body: rows,
  });
}

async function fetchRows(portalId, tableId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows`,
  });
}

module.exports = {
  createRows,
  createTable,
  fetchRows,
  fetchTables,
  publishTable,
  updateRows,
};
