const { moveFile } = require('@hubspot/cli-lib/api/fileMapper');
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
const { isPathFolder } = require('../lib/filesystem');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.mv';

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

const getCorrectedDestPath = (srcPath, destPath) => {
  if (!isPathFolder(srcPath)) {
    return destPath;
  }

  // Makes sure that nested folders are moved independently
  return `${destPath}/${srcPath.split('/').pop()}`;
};

exports.command = 'mv <srcPath> <destPath>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { srcPath, destPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('mv', {}, accountId);

  try {
    await moveFile(accountId, srcPath, getCorrectedDestPath(srcPath, destPath));
    logger.success(
      i18n(`${i18nKey}.move`, {
        accountId,
        destPath,
        srcPath,
      })
    );
  } catch (error) {
    logger.error(
      i18n(`${i18nKey}.errors.moveFailed`, {
        accountId,
        destPath,
        srcPath,
      })
    );
    if (error.statusCode === 409) {
      logger.error(
        i18n(`${i18nKey}.errors.sourcePathExists`, {
          destPath,
          srcPath,
        })
      );
    } else {
      logApiErrorInstance(
        error,
        new ApiErrorContext({
          accountId,
          srcPath,
          destPath,
        })
      );
    }
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('srcPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  yargs.positional('destPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  return yargs;
};
