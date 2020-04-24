import * as http from '../http';
const HUBDB_API_PATH = 'hubdb/api/v2';

export async function fetchTables(portalId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
  });
}

export async function fetchTable(portalId, tableId) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}`,
  });
}

export async function createTable(portalId, schema) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables`,
    body: schema,
  });
}

export async function updateTable(portalId, tableId, schema) {
  return http.put(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}`,
    body: schema,
  });
}

export async function publishTable(portalId, tableId) {
  return http.put(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/publish`,
  });
}

export async function deleteTable(portalId, tableId) {
  return http.delete(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}`,
  });
}

export async function updateRows(portalId, tableId, rows) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows/batch/update`,
    body: rows,
  });
}

export async function createRows(portalId, tableId, rows) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows/batch/create`,
    body: rows,
  });
}

export async function fetchRows(portalId, tableId, query = {}) {
  return http.get(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows`,
    query,
  });
}

export async function deleteRows(portalId, tableId, rowIds) {
  return http.post(portalId, {
    uri: `${HUBDB_API_PATH}/tables/${tableId}/rows/batch/delete`,
    body: rowIds,
  });
}
