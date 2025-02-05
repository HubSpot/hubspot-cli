// @ts-nocheck
const { addConfigOptions } = require('../../lib/commonOpts');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  loadConfig,
  getConfigPath,
  deleteAccount,
  getConfigDefaultAccount,
  getAccountId,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');

const i18nKey = 'commands.account.subcommands.remove';

exports.command = 'remove [account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { account } = options;
  let accountToRemove = account;

  if (accountToRemove && !getAccountId(accountToRemove)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: accountToRemove,
        configPath: getConfigPath(),
      })
    );
  }

  if (!accountToRemove || !getAccountId(accountToRemove)) {
    accountToRemove = await selectAccountFromConfig(
      i18n(`${i18nKey}.prompts.selectAccountToRemove`)
    );
  }

  trackCommandUsage('accounts-remove', null, getAccountId(accountToRemove));

  const currentDefaultAccount = getConfigDefaultAccount();

  await deleteAccount(accountToRemove);
  logger.success(
    i18n(`${i18nKey}.success.accountRemoved`, {
      accountName: accountToRemove,
    })
  );

  // Get updated version of the config
  loadConfig(getConfigPath(), options);

  if (accountToRemove === currentDefaultAccount) {
    logger.log();
    logger.log(i18n(`${i18nKey}.logs.replaceDefaultAccount`));
    const newDefaultAccount = await selectAccountFromConfig();
    updateDefaultAccount(newDefaultAccount);
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.example([
    ['$0 accounts remove', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts remove MyAccount', i18n(`${i18nKey}.examples.byName`)],
  ]);

  return yargs;
};
