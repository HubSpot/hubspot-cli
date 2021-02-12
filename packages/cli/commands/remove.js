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
const { convertToUnixPath } = require('@hubspot/cli-lib/path');

exports.command = 'remove <path>';
exports.describe = 'Delete a file or folder from HubSpot';

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
    let unixPath = convertToUnixPath(hsPath);
    await deleteFile(accountId, unixPath);
    logger.log(`Deleted "${hsPath}" from account ${accountId}`);
  } catch (error) {
    logger.error(`Deleting "${hsPath}" from account ${accountId} failed`);
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
    describe: 'Remote hubspot path',
    type: 'string',
  });
  return yargs;
};
