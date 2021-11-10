const { deleteFile } = require('@hubspot/cli-lib/api/fileMapper');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validateAccount } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.remove';

exports.command = 'remove <path>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath, path: hsPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }

  const accountId = getAccountId(options);

  trackCommandUsage('remove', {}, accountId);

  try {
    await deleteFile(accountId, hsPath);
    logger.log(i18n(`${i18nKey}.deleted`, { accountId, path: hsPath }));
  } catch (error) {
    logger.error(
      i18n(`${i18nKey}.errors.deleteFailed`, { accountId, path: hsPath })
    );
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        accountId,
        request: hsPath,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  return yargs;
};
