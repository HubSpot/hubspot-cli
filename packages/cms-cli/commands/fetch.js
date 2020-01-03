const { version } = require('../package.json');

const { downloadFileOrFolder } = require('@hubspot/cms-lib/fileMapper');
const { loadConfig } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');

const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  addOverwriteOptions,
  addModeOptions,
  getPortalId,
  getMode,
  setLogLevel,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const {
  validateConfig,
  validatePortal,
  validateMode,
} = require('../lib/validation');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'fetch';

function configureFetchCommand(program) {
  program
    .version(version)
    .description(
      'Fetch a file, directory or module from HubSpot and write to a path on your computer'
    )
    .action(async (src, dest) => {
      setLogLevel(program);
      logDebugInfo(program);

      const { config: configPath } = program;
      loadConfig(configPath);

      if (
        !(
          validateConfig() &&
          (await validatePortal(program)) &&
          validateMode(program)
        )
      ) {
        process.exit(1);
      }

      if (typeof src !== 'string') {
        logger.error('A source to fetch is required');
        process.exit(1);
      }

      dest = resolveLocalPath(dest);

      const portalId = getPortalId(program);
      const mode = getMode(program);

      trackCommandUsage(COMMAND_NAME, { mode }, portalId);

      // Fetch and write file/folder.
      downloadFileOrFolder({ portalId, src, dest, mode, options: program });
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addOverwriteOptions(program);
  addModeOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureFetchCommand,
};
