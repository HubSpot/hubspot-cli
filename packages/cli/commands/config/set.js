const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');
const defaultAccount = require('./set/defaultAccount');
const defaultMode = require('./set/defaultMode');
const httpTimeout = require('./set/httpTimeout');

exports.command = 'set';
exports.describe = 'Commands for working with the config file';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(defaultAccount)
    .command(defaultMode)
    .command(httpTimeout)
    .demandCommand(1, '');

  return yargs;
};
