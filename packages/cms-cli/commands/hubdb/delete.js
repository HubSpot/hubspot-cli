const {
  getPortalId,
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { deleteTable } = require('@hubspot/cms-lib/api/hubdb');
const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { version } = require('../../package.json');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

const DELETE_DESCRIPTION = 'delete a HubDB table';

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

  trackCommandUsage('hubdb-delete', {}, command);

  try {
    await deleteTable(portalId, tableId);
    logger.log(`The table ${tableId} was deleted from ${portalId}`);
  } catch (e) {
    logger.error(`Deleting the table ${tableId} failed`);
    logErrorInstance(e);
  }
};

const command = 'delete <tableId>';
const describe = DELETE_DESCRIPTION;
const handler = async argv => action({ tableId: argv.tableId }, argv);
const builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
  });
};

function configureCommanderHubDbDeleteCommand(commander) {
  commander
    .version(version)
    .description(DELETE_DESCRIPTION)
    .arguments('<tableId>')
    .action(async tableId => action({ tableId }, commander));

  addLoggerOptions(commander);
  addPortalOptions(commander);
  addConfigOptions(commander);
}

module.exports = {
  DELETE_DESCRIPTION,
  // Yargs
  command,
  describe,
  handler,
  builder,
  // Commander
  configureCommanderHubDbDeleteCommand,
};
