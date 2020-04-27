const { version } = require('../package.json');
const {
  getConfigPath,
  getPortalId,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} = require('@hubspot/cms-lib/lib/config');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
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
  ERROR: 'error',
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
      trackCommandUsage(COMMAND_NAME, { authType: 'personalaccesskey' });

      const configPath = getConfigPath();

      if (configPath) {
        logger.error(`The config file '${configPath}' already exists.`);
        logger.info(
          'To update an existing config file, use the "hs auth" command.'
        );
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

        logger.success(
          `${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
        );

        const portalId = getPortalId();
        trackAuthAction(
          COMMAND_NAME,
          PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
          TRACKING_STATUS.COMPLETE,
          portalId
        );
      } catch (err) {
        logErrorInstance(err);
        trackAuthAction(
          COMMAND_NAME,
          PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
          TRACKING_STATUS.ERROR
        );
      }
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
