const { version } = require('../package.json');
const {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} = require('@hubspot/cms-lib/lib/config');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const {
  logFileSystemErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cms-lib/lib/constants');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
const {
  trackCommandUsage,
  addHelpUsageTracking,
  trackAuthAction,
} = require('../lib/usageTracking');
const { promptUser, PORTAL_NAME } = require('../lib/prompts');
const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'init';
const TRACKING_STATUS = {
  STARTED: 'started',
  COMPLETE: 'complete',
};

function initializeConfigCommand(program) {
  program
    .version(version)
    .description(
      `initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal`
    )
    .action(async options => {
      setLogLevel(options);
      logDebugInfo(options);
      trackCommandUsage(COMMAND_NAME);

      const configPath = getConfigPath();

      if (configPath) {
        logger.error(`The config file '${configPath}' already exists.`);
        process.exit(1);
      }
      trackAuthAction(
        COMMAND_NAME,
        PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        TRACKING_STATUS.STARTED
      );

      createEmptyConfigFile();
      handleExit(deleteEmptyConfigFile);

      try {
        const configData = await personalAccessKeyPrompt();
        const { name } = await promptUser([PORTAL_NAME]);
        await updateConfigWithPersonalAccessKey(
          {
            ...configData,
            name,
          },
          true
        );

        logger.log(
          `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
        );
      } catch (err) {
        logFileSystemErrorInstance(err, {
          filepath: configPath,
        });
      }

      trackAuthAction(
        COMMAND_NAME,
        PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        TRACKING_STATUS.COMPLETE
      );
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
