// @ts-nocheck
const marketplaceValidate = require('./module/marketplace-validate');
const {
  addConfigOptions,
  addAccountOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');

exports.command = 'module';
exports.describe = false;

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

  yargs.command(marketplaceValidate).demandCommand(1, '');

  return yargs;
};
