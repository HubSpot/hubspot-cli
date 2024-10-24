// @ts-nocheck
const chalk = require('chalk');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { table, getBorderCharacters } = require('table');
const {
  fetchObjectSchemas,
} = require('@hubspot/local-dev-lib/api/customObjects');

const logSchemas = schemas => {
  const data = schemas
    .map(r => [r.labels.singular, r.name, r.objectTypeId || ''])
    .sort((a, b) => (a[1] > b[1] ? 1 : -1));
  data.unshift([
    chalk.bold('Label'),
    chalk.bold('Name'),
    chalk.bold('objectTypeId'),
  ]);

  const tableConfig = {
    singleLine: true,
    border: getBorderCharacters('honeywell'),
  };

  logger.log(data.length ? table(data, tableConfig) : 'No Schemas were found');
};

const listSchemas = async accountId => {
  const { data } = await fetchObjectSchemas(accountId);
  logSchemas(data.results);
};

module.exports = {
  logSchemas,
  listSchemas,
};
