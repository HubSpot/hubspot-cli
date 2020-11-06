const { moveFile } = require('@hubspot/cms-lib/api/fileMapper');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

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
exports.describe =
  'Move a remote file or folder in HubSpot. This feature is currently in beta and the CLI contract is subject to change';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { srcPath, destPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('mv', {}, accountId);

  try {
    await moveFile(accountId, srcPath, getCorrectedDestPath(srcPath, destPath));
    logger.success(
      `Moved "${srcPath}" to "${destPath}" in account ${accountId}`
    );
  } catch (error) {
    logger.error(
      `Moving "${srcPath}" to "${destPath}" in account ${accountId} failed`
    );
    if (error.statusCode === 409) {
      logger.error(`The folder "${srcPath}" already exists in "${destPath}".`);
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
