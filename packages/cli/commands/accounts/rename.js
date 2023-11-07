const { logger } = require('@hubspot/cli-lib/logger');
const { renameAccount } = require('@hubspot/local-dev-lib/config');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.rename';

exports.command = 'rename <accountName> <newName>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { accountName, newName } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('accounts-rename', null, accountId);

  await renameAccount(accountName, newName);

  return logger.log(
    i18n(`${i18nKey}.success.renamed`, {
      name: accountName,
      newName,
    })
  );
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

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
