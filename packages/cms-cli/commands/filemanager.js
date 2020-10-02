const {
  addConfigOptions,
  addPortalOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const upload = require('./filemanager/upload');
const fetch = require('./filemanager/fetch');

exports.command = 'filemanager';
exports.describe = 'Commands for working with the File Manager';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command(upload)
    .command(fetch)
    .demandCommand(1, '');

  return yargs;
};
