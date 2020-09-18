const { deleteFile } = require('@hubspot/cms-lib/api/fileMapper');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

const { version } = require('../package.json');
const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validatePortal } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'remove';
const DESCRIPTION = 'Delete a file or folder from HubSpot';

async function action({ hsPath }, options) {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }

  const portalId = getPortalId(options);

  trackCommandUsage(COMMAND_NAME, {}, portalId);

  try {
    await deleteFile(portalId, hsPath);
    logger.log(`Deleted "${hsPath}" from portal ${portalId}`);
  } catch (error) {
    logger.error(`Deleting "${hsPath}" from portal ${portalId} failed`);
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        portalId,
        request: hsPath,
      })
    );
  }
}

function configureRemoveCommand(program) {
  program
    .version(version)
    .description(DESCRIPTION)
    .arguments('<path>')
    .action(async (hsPath, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      await action({ hsPath }, command);
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addUseEnvironmentOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}
exports.command = `${COMMAND_NAME} <path>`;

exports.describe = DESCRIPTION;

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('path', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  return yargs;
};

exports.handler = async function(argv) {
  await action({ hsPath: argv.path }, argv);
};

exports.configureRemoveCommand = configureRemoveCommand;
