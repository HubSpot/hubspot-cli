// @ts-nocheck
const { addGlobalOptions } = require('../lib/commonOpts');
const createCommand = require('./hubdb/create');
const fetchCommand = require('./hubdb/fetch');
const deleteCommand = require('./hubdb/delete');
const clearCommand = require('./hubdb/clear');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.hubdb';

exports.command = 'hubdb';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addGlobalOptions(yargs);

  yargs
    .command(clearCommand)
    .command(createCommand)
    .command(fetchCommand)
    .command(deleteCommand)
    .demandCommand(1, '');

  return yargs;
};
