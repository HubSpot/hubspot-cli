const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  getConfigPath,
  deleteAccount,
  getConfigDefaultAccount,
  getAccountId: getAccountIdFromConfig,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');
const { loadAndValidateOptions } = require('../../lib/validation');

const i18nKey = 'cli.commands.accounts.subcommands.remove';

exports.command = 'remove [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  let config = getConfig();

  let accountToRemove = options.account;

  if (accountToRemove && !getAccountIdFromConfig(accountToRemove)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: accountToRemove,
        configPath: getConfigPath(),
      })
    );
  }

  if (!accountToRemove || !getAccountIdFromConfig(accountToRemove)) {
    accountToRemove = await selectAccountFromConfig(
      config,
      i18n(`${i18nKey}.prompts.selectAccountToRemove`)
    );
  }

  trackCommandUsage(
    'accounts-remove',
    null,
    getAccountIdFromConfig(accountToRemove)
  );

  const currentDefaultAccount = getConfigDefaultAccount();

  await deleteAccount(accountToRemove);
  logger.success(
    i18n(`${i18nKey}.success.accountRemoved`, {
      accountName: accountToRemove,
    })
  );

  // Get updated version of the config
  config = getConfig();

  if (accountToRemove === currentDefaultAccount) {
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
    ['$0 accounts remove', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts remove --account=MyAccount',
      i18n(`${i18nKey}.examples.byName`),
    ],
  ]);

  return yargs;
};
