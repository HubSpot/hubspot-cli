const {
  lint,
  printHublValidationResult,
} = require('@hubspot/cms-lib/validate');
const { loadConfig, validateConfig } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { version } = require('../package.json');
const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { validatePortal } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'lint';

function configureCommand(command) {
  command
    .version(version)
    .description('lint a file or folder for HubL syntax')
    .arguments('<path>')
    .action(async filepath => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }

      const portalId = getPortalId(command);

      trackCommandUsage(COMMAND_NAME, {}, portalId);

      filepath = resolveLocalPath(filepath);

      const groupName = `Linting "${filepath}"`;
      logger.group(groupName);
      let count = 0;
      try {
        await lint(portalId, filepath, result => {
          count += printHublValidationResult(result);
        });
      } catch (err) {
        logger.groupEnd(groupName);
        logErrorInstance(err, { portalId });
        process.exit(1);
      }
      logger.groupEnd(groupName);
      logger.log('%d issues found', count);
    });

  addConfigOptions(command);
  addPortalOptions(command);
  addLoggerOptions(command);
  addHelpUsageTracking(command, COMMAND_NAME);
}

module.exports = {
  configureCommand,
};
