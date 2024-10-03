const chalk = require('chalk');
const { table } = require('table');

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && source && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

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

function getTableContents(tableData = [], tableConfig = {}) {
  const mergedConfig = mergeDeep({}, tableConfigDefaults, tableConfig);

  return table(tableData, mergedConfig);
}

function getTableHeader(headerItems) {
  return headerItems.map(headerItem => chalk.bold(headerItem));
}

module.exports = {
  getTableContents,
  getTableHeader,
};
