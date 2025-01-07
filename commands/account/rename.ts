// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { renameAccount } = require('@hubspot/local-dev-lib/config');

const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.account.subcommands.rename';

exports.command = 'rename <accountName> <newName>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { accountName, newName, derivedAccountId } = options;

  trackCommandUsage('accounts-rename', null, derivedAccountId);

  await renameAccount(accountName, newName);

  return logger.log(
    i18n(`${i18nKey}.success.renamed`, {
      name: accountName,
      newName,
    })
  );
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs.positional('accountName', {
    describe: i18n(`${i18nKey}.positionals.accountName.describe`),
    type: 'string',
  });
  yargs.positional('newName', {
    describe: i18n(`${i18nKey}.positionals.newName.describe`),
    type: 'string',
  });

  yargs.example([['$0 accounts rename myExistingPortalName myNewPortalName']]);

  return yargs;
};
