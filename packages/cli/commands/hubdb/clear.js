const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { clearHubDbTableRows } = require('@hubspot/cli-lib/hubdb');
const { publishTable } = require('@hubspot/cli-lib/api/hubdb');

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

exports.command = 'clear <tableId>';
exports.describe = 'clear all rows in a HubDB table';

exports.handler = async options => {
  const { config: configPath, tableId } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-clear', {}, accountId);

  try {
    const { deletedRowCount } = await clearHubDbTableRows(accountId, tableId);
    if (deletedRowCount > 0) {
      logger.log(`Removed ${deletedRowCount} rows from HubDB table ${tableId}`);
      const { rowCount } = await publishTable(accountId, tableId);
      logger.log(`HubDB table ${tableId} now contains ${rowCount} rows`);
    } else {
      logger.log(`HubDB table ${tableId} is already empty`);
    }
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
};
