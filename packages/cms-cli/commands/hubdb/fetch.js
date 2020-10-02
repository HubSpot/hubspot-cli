const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { downloadHubDbTable } = require('@hubspot/cms-lib/hubdb');

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

exports.command = 'fetch <tableId> [dest]';
exports.describe = 'fetch a HubDB table';

exports.handler = async options => {
  const { config: configPath, tableId, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('hubdb-fetch', {}, portalId);

  try {
    const { filePath } = await downloadHubDbTable(portalId, tableId, dest);

    logger.log(`Downloaded HubDB table ${tableId} to ${filePath}`);
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

  yargs.positional('dest', {
    describe: 'Local destination folder to fetch table to',
    type: 'string',
  });
};
