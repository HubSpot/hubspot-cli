const path = require('path');
const fs = require('fs-extra');
const prettier = require('prettier');

const {
  createTable,
  createRows,
  fetchTable,
  fetchRows,
  publishTable,
  deleteRows,
  deleteTable,
} = require('./api/hubdb');

async function createHubDbTable(portalId, src) {
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

  const table = fs.readJsonSync(src);
  const { rows, ...schema } = table;

  const { columns, id } = await createTable(portalId, schema);

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
    response = await createRows(portalId, id, rowsToUpdate);
  }

  await publishTable(portalId, id);

  return {
    tableId: id,
    rowCount:
      response && Array.isArray(response) && response.length
        ? response[0].rows.length
        : 0,
  };
}

async function importHubDbTableRows(portalId, tableId, src) {
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

  const table = fs.readJsonSync(src);
  const { rows } = table;

  const { columns } = await fetchTable(portalId, tableId);

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
    tableId: tableId,
    rowCount:
      response && Array.isArray(response) && response.length
        ? response[0].rows.length
        : 0,
  };
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

async function clearHubDbTable(portalId, tableId) {
  const rows = await fetchRows(portalId, tableId);
  const rowIds = rows.objects.map(row => row.id);

  await deleteRows(portalId, tableId, rowIds);
}

async function deleteHubDbTable(portalId, tableId) {
  await deleteTable(portalId, tableId);
}

module.exports = {
  createHubDbTable,
  downloadHubDbTable,
  clearHubDbTable,
  deleteHubDbTable,
  importHubDbTableRows,
};
