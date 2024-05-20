const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const { i18n } = require('../lib/lang');
const create = require('./sandbox/create');
const del = require('./sandbox/delete');
const sync = require('./sandbox/sync');

const i18nKey = 'commands.sandbox';

exports.command = 'sandbox';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs
    .command(create)
    .command(del)
    .command(sync)
    .demandCommand(1, '');

  return yargs;
};
