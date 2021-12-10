const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');
const defaultAccount = require('./set/defaultAccount');
const defaultMode = require('./set/defaultMode');
const httpTimeout = require('./set/httpTimeout');
const allowUsageTracking = require('./set/allowUsageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.config.subcommands.set';

exports.command = 'set';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(defaultAccount)
    .command(defaultMode)
    .command(httpTimeout)
    .command(allowUsageTracking)
    .demandCommand(1, '');

  return yargs;
};
