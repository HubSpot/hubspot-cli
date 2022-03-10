const marketplaceValidate = require('./module/marketplace-validate');
const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.module';

exports.command = 'theme';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(marketplaceValidate).demandCommand(1, '');

  return yargs;
};
