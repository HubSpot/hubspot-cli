const http = require('../http');
const HUBDB_API_PATH = 'hubdb/api/v2';

async function fetchTableCount(portalId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/count`,
  });
}

async function fetchTables(portalId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
  });
}

async function fetchTable(portalId, tableId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}`,
  });
}

async function createTable(portalId, schema) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
    body: schema,
  });
}

async function updateTable(portalId, tableId, schema) {
  return http.put(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}`,
    body: schema,
  });
}

async function publishTable(portalId, tableId) {
  return http.put(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/publish`,
  });
}

async function deleteTable(portalId, tableId) {
  return http.delete(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}`,
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

async function fetchRows(portalId, tableId, query = {}) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows`,
    query,
  });
}

async function deleteRows(portalId, tableId, rowIds) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows/batch/delete`,
    body: rowIds,
  });
}

module.exports = {
  fetchTableCount,
  createRows,
  createTable,
  updateTable,
  fetchRows,
  fetchTable,
  fetchTables,
  publishTable,
  updateRows,
  deleteRows,
  deleteTable,
};
