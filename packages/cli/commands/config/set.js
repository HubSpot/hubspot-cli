const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');
const defaultAccount = require('./set/default-account');
const defaultMode = require('./set/default-mode');

exports.command = 'set';
exports.describe = 'Commands for working with the config file';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(defaultAccount)
    .command(defaultMode)
    .demandCommand(1, '');

  return yargs;
};
