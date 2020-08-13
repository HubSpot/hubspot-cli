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
const { version } = require('../../package.json');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

const CLEAR_DESCRIPTION = 'clear all rows in a HubDB table';

const configureClear = yargs => {
  yargs.command({
    command: 'clear <tableId>',
    describe: CLEAR_DESCRIPTION,
    handler: async argv => action({ tableId: argv.tableId }, argv),
    builder: () => {
      yargs.positional('tableId', {
        describe: 'HubDB Table ID',
        type: 'string',
      });
    },
  });

  addLoggerOptions(yargs, true);
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);
};

function configureCommanderHubDbClearCommand(commander) {
  commander
    .version(version)
    .description(CLEAR_DESCRIPTION)
    .arguments('<tableId>')
    .action(async (tableId, command = {}) => action({ tableId }, command));

  addLoggerOptions(commander);
  addPortalOptions(commander);
  addConfigOptions(commander);
}

const action = async (args, options) => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('hubdb-clear', null, portalId);

  try {
    const { deletedRowCount } = await clearHubDbTableRows(
      portalId,
      args.tableId
    );
    if (deletedRowCount > 0) {
      logger.log(
        `Removed ${deletedRowCount} rows from HubDB table ${args.tableId}`
      );
      const { rowCount } = await publishTable(portalId, args.tableId);
      logger.log(`HubDB table ${args.tableId} now contains ${rowCount} rows`);
    } else {
      logger.log(`HubDB table ${args.tableId} is already empty`);
    }
  } catch (e) {
    logErrorInstance(e);
  }
};

module.exports = {
  CLEAR_DESCRIPTION,
  // Yargs
  configureClear,
  // Commander
  configureCommanderHubDbClearCommand,
};
