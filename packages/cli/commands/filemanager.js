const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const upload = require('./filemanager/upload');
const fetch = require('./filemanager/fetch');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.filemanager';

exports.command = 'filemanager';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(upload)
    .command(fetch)
    .demandCommand(1, '');

  return yargs;
};
