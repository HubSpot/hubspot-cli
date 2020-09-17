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
const { version } = require('../../package.json');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

const FETCH_DESCRIPTION = 'fetch a HubDB table';

const action = async ({ tableId, dest }, options) => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('hubdb-fetch', {}, options);

  try {
    const { filePath } = await downloadHubDbTable(portalId, tableId, dest);

    logger.log(`Downloaded HubDB table ${tableId} to ${filePath}`);
  } catch (e) {
    logErrorInstance(e);
  }
};

const command = 'fetch <tableId> [dest]';
const describe = FETCH_DESCRIPTION;
const handler = async argv =>
  action({ tableId: argv.tableId, dest: argv.dest }, argv);
const builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
    demand: true,
  });

  yargs.positional('dest', {
    describe: 'Local destination folder to fetch table to',
    type: 'string',
  });
};

function configureCommanderHubDbFetchCommand(commander) {
  commander
    .version(version)
    .description(FETCH_DESCRIPTION)
    .arguments('<tableId> [dest]')
    .action(async (tableId, dest, command = {}) =>
      action({ tableId, dest }, command)
    );

  addLoggerOptions(commander);
  addPortalOptions(commander);
  addConfigOptions(commander);
}

module.exports = {
  FETCH_DESCRIPTION,
  // Yargs
  command,
  describe,
  handler,
  builder,
  // Commander
  configureCommanderHubDbFetchCommand,
};
