const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');
const defaultAccount = require('./set/default-account');

exports.command = 'set';
exports.describe = 'Commands for working with the config file';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(defaultAccount).demandCommand(1, '');

  return yargs;
};
