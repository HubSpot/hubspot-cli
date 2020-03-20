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

function configureRemoveCommand(program) {
  program
    .version(version)
    .description('Delete a file or folder from HubSpot')
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

      const portalId = getPortalId(command);

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
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureRemoveCommand,
};
