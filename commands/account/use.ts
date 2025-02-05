// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getConfigPath,
  updateDefaultAccount,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');

const i18nKey = 'commands.account.subcommands.use';

exports.command = 'use [account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let newDefaultAccount = options.account;

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig();
  } else if (!getAccountId(newDefaultAccount)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: newDefaultAccount,
        configPath: getConfigPath(),
      })
    );
    newDefaultAccount = await selectAccountFromConfig();
  }

  trackCommandUsage('accounts-use', null, getAccountId(newDefaultAccount));

  updateDefaultAccount(newDefaultAccount);

  return logger.success(
    i18n(`${i18nKey}.success.defaultAccountUpdated`, {
      accountName: newDefaultAccount,
    })
  );
};

exports.builder = yargs => {
  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.example([
    ['$0 accounts use', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts use MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
    ['$0 accounts use 1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs;
};
