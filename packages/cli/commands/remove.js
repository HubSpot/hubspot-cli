const { deleteFile } = require('@hubspot/cli-lib/api/fileMapper');
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
const { loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');

exports.command = 'remove <path>';
exports.describe = 'Delete a file or folder from HubSpot';

exports.handler = async options => {
  const { path: hsPath } = options;

  await loadAndValidateOptions(options);

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
