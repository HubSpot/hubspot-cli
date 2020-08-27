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
const { version } = require('../../package.json');
const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

const CREATE_DESCRIPTION = 'Create a HubDB table';

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

  trackCommandUsage('hubdb-create', null, portalId);

  try {
    const table = await createHubDbTable(
      portalId,
      path.resolve(getCwd(), args.src)
    );
    logger.log(
      `The table ${table.tableId} was created in ${portalId} with ${table.rowCount} rows`
    );
  } catch (e) {
    logger.error(`Creating the table at "${args.src}" failed`);
    logErrorInstance(e);
  }
};

const command = 'create <src>';
const describe = CREATE_DESCRIPTION;
const handler = async argv => action({ src: argv.src }, argv);
const builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.positional('src', {
    describe: 'local path to file used for import',
    type: 'string',
  });
};

const configureCommanderHubDbCreateCommand = commander => {
  commander
    .version(version)
    .description(CREATE_DESCRIPTION)
    .arguments('<src>')
    .action(async (src, command = {}) => action({ src }, command));

  addLoggerOptions(commander);
  addPortalOptions(commander);
  addConfigOptions(commander);
};

module.exports = {
  CREATE_DESCRIPTION,
  // Yargs
  command,
  describe,
  handler,
  builder,
  // Commander
  configureCommanderHubDbCreateCommand,
};
