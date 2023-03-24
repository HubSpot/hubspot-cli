const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  getConfigPath,
  deleteAccount,
  getConfigDefaultAccount,
  getAccountId: getAccountIdFromConfig,
  updateDefaultAccount,
} = require('@hubspot/cli-lib/lib/config');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');
const { loadAndValidateOptions } = require('../../lib/validation');

const i18nKey = 'cli.commands.accounts.subcommands.delete';

exports.command = 'delete [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  let config = getConfig();

  let accountToDelete = options.account;

  if (accountToDelete && !getAccountIdFromConfig(accountToDelete)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: accountToDelete,
        configPath: getConfigPath(),
      })
    );
  }

  if (!accountToDelete || !getAccountIdFromConfig(accountToDelete)) {
    accountToDelete = await selectAccountFromConfig(
      config,
      i18n(`${i18nKey}.prompts.selectAccountToRemove`)
    );
  }

  trackCommandUsage(
    'accounts-delete',
    null,
    getAccountIdFromConfig(accountToDelete)
  );

  const currentDefaultAccount = getConfigDefaultAccount();

  await deleteAccount(accountToDelete);
  logger.success(
    i18n(`${i18nKey}.success.accountDeleted`, {
      accountName: accountToDelete,
    })
  );

  // Get updated version of the config
  config = getConfig();

  if (accountToDelete === currentDefaultAccount) {
    logger.log();
    logger.log(i18n(`${i18nKey}.logs.replaceDefaultAccount`));
    const newDefaultAccount = await selectAccountFromConfig(config);
    updateDefaultAccount(newDefaultAccount);
  }
};

exports.builder = yargs => {
  yargs.option('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.example([
    ['$0 accounts delete', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts delete --account=MyAccount',
      i18n(`${i18nKey}.examples.byName`),
    ],
  ]);

  return yargs;
};
