// @ts-nocheck
const marketplaceValidate = require('./module/marketplace-validate');
const {
  addConfigOptions,
  addAccountOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
// const { i18n } = require('../lib/lang');

// const i18nKey = 'commands.module';

exports.command = 'module';
exports.describe = false; //i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

  yargs.command(marketplaceValidate).demandCommand(1, '');

  return yargs;
};
