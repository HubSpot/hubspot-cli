const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  getConfigPath,
  updateDefaultAccount,
  getAccountId: getAccountIdFromConfig,
} = require('@hubspot/cli-lib/lib/config');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');
const { loadAndValidateOptions } = require('../../lib/validation');

const i18nKey = 'cli.commands.accounts.subcommands.use';

exports.command = 'use [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  const config = getConfig();

  let newDefaultAccount = options.account;

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig(config);
  } else if (!getAccountIdFromConfig(newDefaultAccount)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: newDefaultAccount,
        configPath: getConfigPath(),
      })
    );
    newDefaultAccount = await selectAccountFromConfig(config);
  }

  trackCommandUsage(
    'accounts-use',
    null,
    getAccountIdFromConfig(newDefaultAccount)
  );

  updateDefaultAccount(newDefaultAccount);

  return logger.success(
    i18n(`${i18nKey}.success.defaultAccountUpdated`, {
      accountName: newDefaultAccount,
    })
  );
};

exports.builder = yargs => {
  yargs.option('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.example([
    ['$0 accounts use', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts use --account=MyAccount',
      i18n(`${i18nKey}.examples.nameBased`),
    ],
    ['$0 accounts use --account=1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs;
};
