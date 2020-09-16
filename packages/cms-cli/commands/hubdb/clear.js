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

// Yargs
const command = 'clear <tableId>';
const describe = CLEAR_DESCRIPTION;
const handler = async argv => action({ tableId: argv.tableId }, argv);
const builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
  });
};

// Commander
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

const action = async ({ tableId }, command) => {
  setLogLevel(command);
  logDebugInfo(command);
  const { config: configPath } = command;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(command)))) {
    process.exit(1);
  }
  const portalId = getPortalId(command);

  trackCommandUsage('hubdb-clear', null, command);

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

module.exports = {
  CLEAR_DESCRIPTION,
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderHubDbClearCommand,
};
