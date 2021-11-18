const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { addSecret } = require('@hubspot/cli-lib/api/secrets');

const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { secretValuePrompt } = require('../../lib/secretPrompt');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.secrets.subcommands.add';

exports.command = 'add <name>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { config: configPath, name: secretName } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);
  trackCommandUsage('secrets-add', {}, accountId);

  try {
    const { secretValue } = await secretValuePrompt();

    await addSecret(accountId, secretName, secretValue);
    logger.success(
      i18n(`${i18nKey}.success.add`, {
        accountId,
        secretName,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.add`, {
        secretName,
      })
    );
    await logServerlessFunctionApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({
        request: 'add secret',
        accountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  return yargs;
};
