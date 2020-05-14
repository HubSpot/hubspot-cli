const path = require('path');
const fs = require('fs-extra');
const prettier = require('prettier');

const {
  createTable,
  updateTable,
  createRows,
  fetchTableCount,
  fetchTables,
  fetchTable,
  fetchRows,
  publishTable,
  deleteRows,
} = require('./api/hubdb');

function validateJsonFile(src) {
  try {
    const stats = fs.statSync(src);
    if (!stats.isFile()) {
      throw new Error(`The "${src}" path is not a path to a file`);
    }
  } catch (e) {
    throw new Error(`The "${src}" path is not a path to a file`);
  }

  if (path.extname(src) !== '.json') {
    throw new Error('The HubDB table file must be a ".json" file');
  }
}

async function getTableIdByName(portalId, tableName) {
  let totalTables = await fetchTableCount(portalId);

  let count = 0;
  let offset = 0;

  while (totalTables === null || count < totalTables) {
    const response = await fetchTables(portalId, { offset });

    count += response.objects.length;
    offset += response.objects.length;

    const findTable = response.objects.find(table => table.name === tableName);
    if (findTable) {
      return findTable.id;
    }
  }
}

async function getTableId(portalId, nameOrId) {
  if (typeof nameOrId === 'number') {
    return nameOrId;
  } else if (/^\d+$/.test(nameOrId)) {
    return parseInt(nameOrId, 10);
  } else {
    return getTableIdByName(portalId, nameOrId);
  }
}
async function addRowsToHubDbTable(portalId, tableId, rows, columns) {
  const rowsToUpdate = rows.map(row => {
    const values = {};

    columns.forEach(col => {
      const { name, id } = col;
      if (typeof row.values[name] !== 'undefined') {
        values[id] = row.values[name];
      } else {
        values[id] = null;
      }
    });

    return {
      childTableId: 0,
      isSoftEditable: false,
      ...row,
      values,
    };
  });

  let response;
  if (rowsToUpdate.length > 0) {
    response = await createRows(portalId, tableId, rowsToUpdate);
  }

  await publishTable(portalId, tableId);

  return {
    tableId,
    rowCount:
      response && Array.isArray(response) && response.length
        ? response[0].rows.length
        : 0,
  };
}

async function createHubDbTable(portalId, src) {
  validateJsonFile(src);

  const table = fs.readJsonSync(src);
  const { rows, ...schema } = table;
  const { columns, id } = await createTable(portalId, schema);

  return addRowsToHubDbTable(portalId, id, rows, columns);
}

async function updateHubDbTable(portalId, tableId, src) {
  validateJsonFile(src);

  const table = fs.readJsonSync(src);
  const { ...schema } = table;

  return updateTable(portalId, tableId, schema);
}

function convertToJSON(table, rows) {
  const {
    allowChildTables,
    allowPublicApiAccess,
    columns,
    dynamicMetaTags,
    enableChildTablePages,
    label,
    name,
    useForPages,
  } = table;

  const cleanedColumns = columns
    .filter(column => !column.deleted)
    .map(column => {
      const cleanedColumn = {
        ...column,
      };

      delete cleanedColumn.id;
      delete cleanedColumn.deleted;
      delete cleanedColumn.foreignIdsByName;
      delete cleanedColumn.foreignIdsById;

      return cleanedColumn;
    });

  const cleanedRows = rows.map(row => {
    const values = {};

    columns.forEach(col => {
      const { name, id } = col;
      if (row.values[id] !== null) {
        values[name] = row.values[id];
      }
    });
    return {
      path: row.path,
      name: row.name,
      isSoftEditable: row.isSoftEditable,
      values,
    };
  });

  return {
    name,
    useForPages,
    label,
    allowChildTables,
    allowPublicApiAccess,
    dynamicMetaTags,
    enableChildTablePages,
    columns: cleanedColumns,
    rows: cleanedRows,
  };
}

async function downloadHubDbTable(portalId, tableId, dest) {
  const table = await fetchTable(portalId, tableId);

  let totalRows = null;
  let rows = [];
  let count = 0;
  let offset = 0;
  while (totalRows === null || count < totalRows) {
    const response = await fetchRows(portalId, tableId, { offset });
    if (totalRows === null) {
      totalRows = response.total;
    }

    count += response.objects.length;
    offset += response.objects.length;
    rows = rows.concat(response.objects);
  }

  const tableToWrite = JSON.stringify(convertToJSON(table, rows));
  const tableJson = prettier.format(tableToWrite, {
    parser: 'json',
  });

  await fs.writeFileSync(dest, tableJson);
}

async function clearHubDbTableRows(portalId, tableId) {
  let totalRows = null;
  let rows = [];
  let count = 0;
  let offset = 0;
  while (totalRows === null || count < totalRows) {
    const response = await fetchRows(portalId, tableId, { offset });
    if (totalRows === null) {
      totalRows = response.total;
    }

    count += response.objects.length;
    offset += response.objects.length;
    const rowIds = response.objects.map(row => row.id);
    rows = rows.concat(rowIds);
  }
  await deleteRows(portalId, tableId, rows);
}

module.exports = {
  createHubDbTable,
  downloadHubDbTable,
  clearHubDbTableRows,
  updateHubDbTable,
  addRowsToHubDbTable,
  getTableId,
};
