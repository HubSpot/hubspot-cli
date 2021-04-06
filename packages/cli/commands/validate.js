const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const validateTheme = require('./validate/validateTheme');

exports.command = 'validate';
exports.describe = 'Commands for working with validation';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(validateTheme).demandCommand(1, '');

  return yargs;
};
