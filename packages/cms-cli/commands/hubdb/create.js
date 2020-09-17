const path = require('path');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getCwd } = require('@hubspot/cms-lib/path');
const { createHubDbTable } = require('@hubspot/cms-lib/hubdb');

const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

exports.command = 'create <src>';
exports.describe = 'Create a HubDB table';

exports.handler = async options => {
  const { config: configPath, src } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('hubdb-create', null, portalId);

  try {
    const table = await createHubDbTable(portalId, path.resolve(getCwd(), src));
    logger.log(
      `The table ${table.tableId} was created in ${portalId} with ${table.rowCount} rows`
    );
  } catch (e) {
    logger.error(`Creating the table at "${src}" failed`);
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.positional('src', {
    describe: 'local path to file used for import',
    type: 'string',
  });
};
