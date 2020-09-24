const createCommand = require('./schema/create');
const fetchCommand = require('./schema/fetch');
const fetchAllCommand = require('./schema/fetch-all');
const deleteCommand = require('./schema/delete');
const listCommand = require('./schema/list');
const updateSchema = require('./schema/update');
// const associationsCommand = require('./schema/associations');

exports.command = 'schema';
exports.describe = 'Manage custom object schemas';
exports.builder = yargs => {
  yargs
    .command(listCommand)
    .command(fetchCommand)
    .command(fetchAllCommand)
    .command(createCommand)
    .command(updateSchema)
    .command(deleteCommand)
    .demandCommand(1, '');
  // .command(associationsCommand);

  return yargs;
};
