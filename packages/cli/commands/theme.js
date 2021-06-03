const marketplaceValidate = require('./marketplaceValidate/validateTheme');
const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');

exports.command = 'theme';
exports.describe = false; // 'Commands for working with themes';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(marketplaceValidate).demandCommand(1, '');

  return yargs;
};
