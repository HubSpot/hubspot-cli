const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');
const defaultCommand = require('./set/default');

exports.command = 'set';
exports.describe = 'Commands for working with the config file';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(defaultCommand).demandCommand(1, '');

  return yargs;
};
