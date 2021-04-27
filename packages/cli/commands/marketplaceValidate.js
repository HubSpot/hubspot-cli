const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const validateTheme = require('./marketplaceValidate/validateTheme');

exports.command = 'marketplace-validate';
exports.describe = 'Commands for working with marketplace validation';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(validateTheme).demandCommand(1, '');

  return yargs;
};
