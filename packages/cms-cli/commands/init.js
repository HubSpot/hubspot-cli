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
const { QA, PROD } = require('@hubspot/cms-lib/lib/environment');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { logger } = require('@hubspot/cms-lib/logger');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  userTokenPrompt,
  updateConfigWithUserToken,
} = require('@hubspot/cms-lib/userToken');
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
} = require('../lib/prompts');
const {
  addLoggerOptions,
  addTestingOptions,
  setLogLevel,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'init';
const TRACKING_STATUS = {
  STARTED: 'started',
  COMPLETE: 'complete',
};
const AUTH_METHOD_FLOW = {
  [AUTH_METHODS.api.value]: {
    prompt: async () => {
      return promptUser(API_KEY_FLOW);
    },
    setup: async configData => {
      createEmptyConfigFile();
      handleExit(deleteEmptyConfigFile);
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
      handleExit(deleteEmptyConfigFile);
      await authenticateWithOauth(configData);
      logger.log(
        `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${AUTH_METHODS.oauth.name}.`
      );
      process.exit();
    },
  },
  [USER_TOKEN_AUTH_METHOD.value]: {
    prompt: async options => {
      return userTokenPrompt(options);
    },
    setup: async configData => {
      await updateConfigWithUserToken(configData, {
        makeDefault: true,
        env: configData.env,
        firstEntry: true,
      });
    },
  },
};

const completeConfigSetup = async ({ authMethod, configPath, env }) => {
  const flow = AUTH_METHOD_FLOW[authMethod];
  trackAuthAction(COMMAND_NAME, authMethod, TRACKING_STATUS.STARTED);

  try {
    const promptData = await flow.prompt({ env });
    await flow.setup({ ...promptData, env });
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
    .option('--user-token', 'utilize user token for auth')
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
        const promptResp = await promptUser(AUTH_METHOD);
        authMethod = promptResp.authMethod;
      }

      await completeConfigSetup({
        authMethod,
        configPath,
        env: options.qa ? QA : PROD,
      });
    });

  addLoggerOptions(program);
  addTestingOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
