const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { downloadHubDbTable } = require('@hubspot/cli-lib/hubdb');

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

exports.command = 'fetch <tableId> [dest]';
exports.describe = 'fetch a HubDB table';

exports.handler = async options => {
  const { config: configPath, tableId, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-fetch', {}, accountId);

  try {
    const { filePath } = await downloadHubDbTable(accountId, tableId, dest);

    logger.log(`Downloaded HubDB table ${tableId} to ${filePath}`);
  } catch (e) {
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
  });

  yargs.positional('dest', {
    describe: 'Local destination folder to fetch table to',
    type: 'string',
  });
};
