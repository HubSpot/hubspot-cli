const {
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
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

const DELETE_DESCRIPTION = 'delete a HubDB table';

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

  trackCommandUsage('hubdb-delete', null, portalId);

  try {
    await deleteTable(portalId, args.tableId);
    logger.log(`The table ${args.tableId} was deleted from ${portalId}`);
  } catch (e) {
    logger.error(`Deleting the table ${args.tableId} failed`);
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
