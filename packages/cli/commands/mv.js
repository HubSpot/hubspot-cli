const { moveFile } = require('@hubspot/cli-lib/api/fileMapper');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { isPathFolder } = require('../lib/filesystem');
const { loadAndValidateOptions } = require('../lib/validation');

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
  await loadAndValidateOptions(options);

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
