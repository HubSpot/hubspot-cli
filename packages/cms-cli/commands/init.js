const open = require('open');
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
  USER_TOKEN_AUTH_METHOD,
} = require('@hubspot/cms-lib/lib/constants');
const { logger } = require('@hubspot/cms-lib/logger');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  trackCommandUsage,
  addHelpUsageTracking,
  trackAuthAction,
} = require('../lib/usageTracking');
const {
  promptUser,
  OAUTH_FLOW,
  API_KEY_FLOW,
  AUTH_METHOD,
  USER_TOKEN_FLOW,
  USER_TOKEN,
} = require('../lib/prompts');
const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'init';
const TRACKING_STATUS = {
  STARTED: 'started',
  COMPLETE: 'complete',
};
const handleExit = () => {
  process.on('exit', deleteEmptyConfigFile);
  process.on('SIGINT', deleteEmptyConfigFile);
};
const AUTH_METHOD_FLOW = {
  [AUTH_METHODS.api.value]: {
    prompt: async () => {
      return promptUser(API_KEY_FLOW);
    },
    setup: async configData => {
      createEmptyConfigFile();
      handleExit();
      updateDefaultPortal(configData.name);
      updatePortalConfig({
        ...configData,
        authType: AUTH_METHODS.api.value,
      });
      logger.log(
        `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${AUTH_METHODS.api.name}.`
      );
    },
  },
  [AUTH_METHODS.oauth.value]: {
    prompt: async () => {
      return promptUser(OAUTH_FLOW);
    },
    setup: async configData => {
      createEmptyConfigFile();
      handleExit();
      await authenticateWithOauth(configData);
      logger.log(
        `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${AUTH_METHODS.oauth.name}.`
      );
      process.exit();
    },
  },
  [USER_TOKEN_AUTH_METHOD.value]: {
    prompt: async () => {
      const firstPrompt = await promptUser(USER_TOKEN_FLOW);
      open(`https://local.hubspot.com/user-token/${firstPrompt.portalId}`);
      const secondPrompt = await promptUser(USER_TOKEN);

      return {
        ...firstPrompt,
        ...secondPrompt,
      };
    },
    setup: async configData => {
      createEmptyConfigFile();
      handleExit();
      updateDefaultPortal(configData.name);
      updatePortalConfig({
        ...configData,
        authType: USER_TOKEN_AUTH_METHOD.value,
      });
      logger.log(
        `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${USER_TOKEN_AUTH_METHOD.name}.`
      );
    },
  },
};

const completeConfigSetup = async ({ authMethod, configPath }) => {
  const flow = AUTH_METHOD_FLOW[authMethod];
  trackAuthAction(COMMAND_NAME, authMethod, TRACKING_STATUS.STARTED);

  try {
    flow.setup(await flow.prompt());
  } catch (err) {
    logFileSystemErrorInstance(err, {
      filepath: configPath,
    });
  }

  trackAuthAction(COMMAND_NAME, authMethod, TRACKING_STATUS.COMPLETE);
};

function initializeConfigCommand(program) {
  program
    .version(version)
    .description(
      `initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal`
    )
    .option('--user-token', 'try the new user token flow, it rules!')
    .action(async options => {
      setLogLevel(options);
      logDebugInfo(options);
      trackCommandUsage(COMMAND_NAME);

      const configPath = getConfigPath();
      let authMethod;

      if (configPath) {
        logger.error(`The config file '${configPath}' already exists.`);
        process.exit(1);
      }

      if (options.userToken) {
        authMethod = USER_TOKEN_AUTH_METHOD.value;
      } else {
        authMethod = await promptUser(AUTH_METHOD).authMethod;
      }

      console.log('111', authMethod, configPath);
      return completeConfigSetup({
        authMethod,
        configPath,
      });
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
