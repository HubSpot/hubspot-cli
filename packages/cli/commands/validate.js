const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const validateTheme = require('./validation/validateTheme');

exports.command = 'validate';
exports.describe = 'Commands for working with validation';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(validateTheme).demandCommand(1, '');

  return yargs;
};
