// @ts-nocheck
const upload = require('./filemanager/upload');
const fetch = require('./filemanager/fetch');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.filemanager';

exports.command = 'filemanager';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  yargs
    .command(upload)
    .command(fetch)
    .demandCommand(1, '');

  return yargs;
};
