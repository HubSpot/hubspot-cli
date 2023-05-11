const createCommand = require('./schema/create');
const fetchCommand = require('./schema/fetch');
const fetchAllCommand = require('./schema/fetch-all');
const deleteCommand = require('./schema/delete');
const listCommand = require('./schema/list');
const updateSchema = require('./schema/update');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.customObject.subcommands.schema';

exports.command = 'schema';
exports.describe = i18n(`${i18nKey}.describe`);
exports.builder = yargs => {
  yargs
    .command(listCommand)
    .command(fetchCommand)
    .command(fetchAllCommand)
    .command(createCommand)
    .command(updateSchema)
    .command(deleteCommand)
    .demandCommand(1, '');

  return yargs;
};
