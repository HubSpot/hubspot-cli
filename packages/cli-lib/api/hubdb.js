const http = require('../http');
const HUBDB_API_PATH = 'cms/v3/hubdb';

async function fetchTables(accountId) {
  return http.get(accountId, {
    url: `${HUBDB_API_PATH}/tables`,
  });
}

async function fetchTable(accountId, tableId) {
  return http.get(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}`,
  });
}

async function createTable(accountId, schema) {
  return http.post(accountId, {
    url: `${HUBDB_API_PATH}/tables`,
    data: schema,
  });
}

async function updateTable(accountId, tableId, schema) {
  return http.patch(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}/draft`,
    data: schema,
  });
}

async function publishTable(accountId, tableId) {
  return http.post(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}/draft/publish`,
  });
}

async function deleteTable(accountId, tableId) {
  return http.delete(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}`,
  });
}

async function updateRows(accountId, tableId, rows) {
  return http.post(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}/rows/draft/batch/update`,
    data: rows,
  });
}

async function createRows(accountId, tableId, rows) {
  return http.post(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}/rows/draft/batch/create`,
    data: { inputs: rows },
  });
}

async function fetchRows(accountId, tableId, query = {}) {
  return http.get(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}/rows/draft`,
    query,
  });
}

async function deleteRows(accountId, tableId, rowIds) {
  return http.post(accountId, {
    url: `${HUBDB_API_PATH}/tables/${tableId}/rows/draft/batch/purge`,
    data: { inputs: rowIds },
  });
}

module.exports = {
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
