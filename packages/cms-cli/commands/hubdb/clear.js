const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { clearHubDbTableRows } = require('@hubspot/cms-lib/hubdb');
const { publishTable } = require('@hubspot/cms-lib/api/hubdb');

const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addPortalOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getPortalId,
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

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('hubdb-clear', {}, portalId);

  try {
    const { deletedRowCount } = await clearHubDbTableRows(portalId, tableId);
    if (deletedRowCount > 0) {
      logger.log(`Removed ${deletedRowCount} rows from HubDB table ${tableId}`);
      const { rowCount } = await publishTable(portalId, tableId);
      logger.log(`HubDB table ${tableId} now contains ${rowCount} rows`);
    } else {
      logger.log(`HubDB table ${tableId} is already empty`);
    }
  } catch (e) {
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
  });
};
