const path = require('path');
const fs = require('fs-extra');

const { createTable, createRows } = require('./api/hubdb');

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

  return {
    tableId: id,
    rowCount:
      response && Array.isArray(response) && response.length
        ? response[0].rows.length
        : 0,
  };
}

module.exports = {
  createHubDbTable,
};
