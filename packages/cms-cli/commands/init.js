const { version } = require('../package.json');
const {
  getConfigPath,
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
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

const oauthConfigSetup = async ({ configPath }) => {
  trackCommandUsage(COMMAND_NAME, {
    authMethod: AUTH_METHODS.api.value,
    status: 'started',
  });
  const configData = await promptUser(OAUTH_FLOW);

  try {
    await authenticateWithOauth(configData);
    process.exit();
  } catch (err) {
    logFileSystemErrorInstance(err, {
      filepath: configPath,
      configData,
    });
  }

  trackCommandUsage(COMMAND_NAME, {
    authMethod: AUTH_METHODS.oauth.value,
    status: 'complete',
  });
};

const apiKeyConfigSetup = async ({ configPath }) => {
  trackCommandUsage(COMMAND_NAME, {
    authMethod: AUTH_METHODS.api.value,
    status: 'started',
  });
  const configData = await promptUser(API_KEY_FLOW);

  try {
    updateDefaultPortal(configData.name);
    updatePortalConfig(configData);
  } catch (err) {
    logFileSystemErrorInstance(err, {
      filepath: configPath,
      configData,
    });
  }

  trackCommandUsage(COMMAND_NAME, {
    authMethod: AUTH_METHODS.api.value,
    status: 'complete',
  });
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

      const configPath = getConfigPath();

      if (configPath) {
        logger.error(`The config file '${configPath}' already exists.`);
        process.exit(1);
      }

      createEmptyConfigFile();
      process.on('exit', deleteEmptyConfigFile);

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
