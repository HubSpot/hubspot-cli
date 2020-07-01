const path = require('path');
const fs = require('fs-extra');
const prettier = require('prettier');

const {
  createTable,
  updateTable,
  createRows,
  fetchTable,
  fetchRows,
  publishTable,
  deleteRows,
} = require('./api/hubdb');
const { getCwd } = require('@hubspot/cms-lib/path');

function validateJsonPath(src) {
  if (path.extname(src) !== '.json') {
    throw new Error('The HubDB table file must be a ".json" file');
  }
}

function validateJsonFile(src) {
  try {
    const stats = fs.statSync(src);
    if (!stats.isFile()) {
      throw new Error(`The "${src}" path is not a path to a file`);
    }
  } catch (e) {
    throw new Error(`The "${src}" path is not a path to a file`);
  }

  validateJsonPath(src);
}

async function addRowsToHubDbTable(portalId, tableId, rows) {
  const rowsToUpdate = rows.map(row => {
    const values = row.values;

    return {
      childTableId: 0,
      isSoftEditable: false,
      ...row,
      values,
    };
  });

  if (rowsToUpdate.length > 0) {
    await createRows(portalId, tableId, rowsToUpdate);
  }

  const { rowCount } = await publishTable(portalId, tableId);

  return {
    tableId,
    rowCount,
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

  dest = path.resolve(getCwd(), dest || `${table.name}.hubdb.json`);

  if (fs.pathExistsSync(dest)) {
    validateJsonFile(dest);
  } else {
    validateJsonPath(dest);
  }

  let totalRows = null;
  let rows = [];
  let count = 0;
  let offset = 0;
  while (totalRows === null || count < totalRows) {
    const response = await fetchRows(portalId, tableId, { offset });
    if (totalRows === null) {
      totalRows = response.total;
    }

    count += response.results.length;
    offset += response.results.length;
    rows = rows.concat(response.results);
  }

  const tableToWrite = JSON.stringify(convertToJSON(table, rows));
  const tableJson = prettier.format(tableToWrite, {
    parser: 'json',
  });

  await fs.outputFile(dest, tableJson);

  return { filePath: dest };
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

    count += response.results.length;
    offset += response.results.length;
    const rowIds = response.results.map(row => row.id);
    rows = rows.concat(rowIds);
  }
  await deleteRows(portalId, tableId, rows);

  return {
    deletedRowCount: rows.length,
  };
}

module.exports = {
  createHubDbTable,
  downloadHubDbTable,
  clearHubDbTableRows,
  updateHubDbTable,
  addRowsToHubDbTable,
};
