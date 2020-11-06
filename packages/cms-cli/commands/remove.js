const { deleteFile } = require('@hubspot/cms-lib/api/fileMapper');
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
    await deleteFile(accountId, hsPath);
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
