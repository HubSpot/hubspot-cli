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
const { getCwd } = require('./path');

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

async function addRowsToHubDbTable(accountId, tableId, rows) {
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
    await createRows(accountId, tableId, rowsToUpdate);
  }

  const { rowCount } = await publishTable(accountId, tableId);

  return {
    tableId,
    rowCount,
  };
}

async function createHubDbTable(accountId, src) {
  validateJsonFile(src);

  const table = fs.readJsonSync(src);
  const { rows, ...schema } = table;
  const { columns, id } = await createTable(accountId, schema);

  return addRowsToHubDbTable(accountId, id, rows, columns);
}

async function updateHubDbTable(accountId, tableId, src) {
  validateJsonFile(src);

  const table = fs.readJsonSync(src);
  const { ...schema } = table;

  return updateTable(accountId, tableId, schema);
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
    .filter(column => !column.deleted || !column.archived)
    .map(column => {
      const cleanedColumn = {
        ...column,
      };

      delete cleanedColumn.id;
      delete cleanedColumn.deleted;
      delete cleanedColumn.archived;
      delete cleanedColumn.foreignIdsByName;
      delete cleanedColumn.foreignIdsById;

      return cleanedColumn;
    });

  const cleanedRows = rows.map(row => {
    return {
      path: row.path,
      name: row.name,
      values: row.values,
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

async function fetchAllRows(accountId, tableId) {
  let rows = [];
  let after = null;
  do {
    const { paging, results } = await fetchRows(
      accountId,
      tableId,
      after ? { after } : null
    );

    rows = rows.concat(results);
    after = paging && paging.next ? paging.next.after : null;
  } while (after !== null);

  return rows;
}

async function downloadHubDbTable(accountId, tableId, dest) {
  const table = await fetchTable(accountId, tableId);

  dest = path.resolve(getCwd(), dest || `${table.name}.hubdb.json`);

  if (fs.pathExistsSync(dest)) {
    validateJsonFile(dest);
  } else {
    validateJsonPath(dest);
  }

  const rows = await fetchAllRows(accountId, tableId);
  const tableToWrite = JSON.stringify(convertToJSON(table, rows));
  const tableJson = prettier.format(tableToWrite, {
    parser: 'json',
  });

  await fs.outputFile(dest, tableJson);

  return { filePath: dest };
}

async function clearHubDbTableRows(accountId, tableId) {
  const rows = await fetchAllRows(accountId, tableId);
  await deleteRows(
    accountId,
    tableId,
    rows.map(row => row.id)
  );

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
