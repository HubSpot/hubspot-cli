const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const createCommand = require('./hubdb/create');
const fetchCommand = require('./hubdb/fetch');
const deleteCommand = require('./hubdb/delete');
const clearCommand = require('./hubdb/clear');

exports.command = 'hubdb';
exports.describe = 'Manage HubDB tables';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(clearCommand)
    .command(createCommand)
    .command(fetchCommand)
    .command(deleteCommand)
    .demandCommand(1, '');

  return yargs;
};
