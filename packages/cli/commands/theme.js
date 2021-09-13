const marketplaceValidate = require('./marketplaceValidate/validateTheme');
const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');

exports.command = 'theme';
exports.describe = 'Commands for working with themes, including marketplace validation';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(marketplaceValidate).demandCommand(1, '');

  return yargs;
};
