const chalk = require('chalk');
const { table } = require('table');
const { mergeDeep } = require('./utils');

const tableConfigDefaults = {
  singleLine: true,
  border: {
    topBody: '',
    topJoin: '',
    topLeft: '',
    topRight: '',

    bottomBody: '',
    bottomJoin: '',
    bottomLeft: '',
    bottomRight: '',

    bodyLeft: '',
    bodyRight: '',
    bodyJoin: '',

    joinBody: '',
    joinLeft: '',
    joinRight: '',
    joinJoin: '',
  },
  columnDefault: {
    paddingLeft: 0,
    paddingRight: 1,
  },
  drawHorizontalLine: () => {
    return false;
  },
};

const getTableContents = (tableData = [], tableConfig = {}) => {
  const mergedConfig = mergeDeep({}, tableConfigDefaults, tableConfig);

  return table(tableData, mergedConfig);
};

const getTableHeader = headerItems => {
  return headerItems.map(headerItem => chalk.bold(headerItem));
};

module.exports = {
  getTableContents,
  getTableHeader,
};
