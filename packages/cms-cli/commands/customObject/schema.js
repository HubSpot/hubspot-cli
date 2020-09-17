const { addConfigOptions, addPortalOptions } = require('../../lib/commonOpts');
const createCommand = require('./schema/create');
const fetchCommand = require('./schema/fetch');
const fetchAllCommand = require('./schema/fetch-all');
const deleteCommand = require('./schema/delete');
const listCommand = require('./schema/list');
const updateSchema = require('./schema/update');

exports.command = 'schema';
exports.describe = 'Manage Custom Object Schema';
exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command(listCommand)
    .command(fetchCommand)
    .command(fetchAllCommand)
    .command(createCommand)
    .command(updateSchema)
    .command(deleteCommand);

  return yargs;
};
