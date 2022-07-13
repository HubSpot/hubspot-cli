const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  getConfigPath,
  updateDefaultAccount,
  getAccountId: getAccountIdFromConfig,
} = require('@hubspot/cli-lib/lib/config');

const { setLogLevel } = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  checkAndWarnGitInclusion,
  validateConfig,
} = require('@hubspot/cli-lib');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.accounts.subcommands.use';

exports.command = 'use [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  /*
    Extracted loadAndValidateOptions for cases where
    the set default account does not exist
  */

  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion(getConfigPath());
  if (!validateConfig()) {
    process.exit(EXIT_CODES.ERROR);
  }

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
    {},
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
