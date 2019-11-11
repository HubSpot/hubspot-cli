const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const { watch, loadConfig } = require('@hubspot/cms-lib');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');

const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  addModeOptions,
  setLogLevel,
  getPortalId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  validateConfig,
  validatePortal,
  validateMode,
} = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'watch';

function configureWatchCommand(program) {
  program
    .version(version)
    .description(
      'Watch a directory on your computer for changes and upload the changed files to the HubSpot CMS'
    )
    .arguments('<src> <dest>')
    .option('--remove', 'remove remote files when removed locally')
    .action(async (src, dest, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath, remove } = command;
      loadConfig(configPath);

      if (
        !(
          validateConfig() &&
          (await validatePortal(command)) &&
          validateMode(program)
        )
      ) {
        process.exit(1);
      }

      const portalId = getPortalId(command);
      const mode = getMode(command);

      const absoluteSrcPath = path.resolve(getCwd(), src);
      try {
        const stats = fs.statSync(absoluteSrcPath);
        if (!stats.isDirectory()) {
          logger.log(`The "${src}" is not a path to a directory`);
          return;
        }
      } catch (e) {
        logger.log(`The "${src}" is not a path to a directory`);
        return;
      }

      if (!dest) {
        logger.log('A destination directory needs to be passed');
        return;
      }

      trackCommandUsage(COMMAND_NAME, { mode }, portalId);
      watch(portalId, absoluteSrcPath, dest, {
        mode,
        cwd: getCwd(),
        remove,
      });
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addModeOptions(program, { write: true });
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureWatchCommand,
};
