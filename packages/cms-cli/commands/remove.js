const path = require('path');

const { deleteFile, deleteFolder } = require('@hubspot/cms-lib/api/fileMapper');
const { loadConfig } = require('@hubspot/cms-lib');
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
const { validateConfig, validatePortal } = require('../lib/validation');
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

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }

      const portalId = getPortalId(command);

      trackCommandUsage(COMMAND_NAME, {}, portalId);

      const ext = path.extname(hsPath);

      // Note: module directories (e.g. Foo.module) are treated like files
      if (!ext) {
        deleteFolder(portalId, hsPath)
          .then(() => {
            logger.log(`Deleted "${hsPath}" from portal ${portalId}`);
          })
          .catch(error => {
            logger.error(`Deleting "${hsPath}" from portal ${portalId} failed`);
            logApiErrorInstance(
              error,
              new ApiErrorContext({
                portalId,
                request: hsPath,
              })
            );
          });
      } else {
        deleteFile(portalId, hsPath)
          .then(() => {
            logger.log(`Deleted "${hsPath}" from portal ${portalId}`);
          })
          .catch(error => {
            logger.error(`Deleting "${hsPath}" from portal ${portalId} failed`);
            logApiErrorInstance(
              error,
              new ApiErrorContext({
                portalId,
                request: hsPath,
              })
            );
          });
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
