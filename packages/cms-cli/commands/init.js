const { version } = require('../package.json');
const {
  getConfigPath,
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
} = require('@hubspot/cms-lib/lib/config');
const {
  logFileSystemErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  AUTH_METHODS,
} = require('@hubspot/cms-lib/lib/constants');
const { logger } = require('@hubspot/cms-lib/logger');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const {
  promptUser,
  OAUTH_FLOW,
  API_KEY_FLOW,
  AUTH_METHOD,
} = require('../lib/prompts');
const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'init';
const TRACKING_STATUS = {
  STARTED: 'started',
  COMPLETE: 'complete',
};

const trackAuthMethodStatus = (authMethod, status) => {
  return trackCommandUsage(`${authMethod} ${status}`);
};

const oauthConfigSetup = async ({ configPath }) => {
  const authMethod = AUTH_METHODS.oauth.value;
  trackAuthMethodStatus(authMethod, TRACKING_STATUS.STARTED);
  const configData = await promptUser(OAUTH_FLOW);

  try {
    createEmptyConfigFile({
      deleteOnExitIfBlank: true,
    });
    await authenticateWithOauth(configData);
    process.exit();
  } catch (err) {
    logFileSystemErrorInstance(err, {
      filepath: configPath,
      configData,
    });
  }

  trackAuthMethodStatus(authMethod, TRACKING_STATUS.COMPLETE);
};

const apiKeyConfigSetup = async ({ configPath }) => {
  const authMethod = AUTH_METHODS.api.value;
  trackAuthMethodStatus(authMethod, TRACKING_STATUS.STARTED);
  const configData = await promptUser(API_KEY_FLOW);

  try {
    createEmptyConfigFile({
      deleteOnExitIfBlank: true,
    });
    updateDefaultPortal(configData.name);
    updatePortalConfig(configData);
  } catch (err) {
    logFileSystemErrorInstance(err, {
      filepath: configPath,
      configData,
    });
  }

  trackAuthMethodStatus(authMethod, TRACKING_STATUS.COMPLETE);
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

      const { authMethod } = await promptUser(AUTH_METHOD);

      if (authMethod === AUTH_METHODS.api.value) {
        return apiKeyConfigSetup({
          configPath,
        });
      } else if (authMethod === AUTH_METHODS.oauth.value) {
        return oauthConfigSetup({
          configPath,
        });
      }
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
