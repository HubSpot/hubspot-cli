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
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cms-lib/lib/constants');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { logger } = require('@hubspot/cms-lib/logger');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
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
  PORTAL_NAME,
} = require('../lib/prompts');
const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
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
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: {
    prompt: personalAccessKeyPrompt,
    setup: async configData => {
      const { portalId } = await updateConfigWithPersonalAccessKey(configData);
      const promptAnswer = await promptUser([PORTAL_NAME]);
      updatePortalConfig({
        portalId,
        name: promptAnswer.name,
      });
      updateDefaultPortal(promptAnswer.name);
      process.exit();
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
    .option('--personal-access-key', 'utilize personal access key for auth')
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

      if (options.personalAccessKey) {
        authMethod = PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
      } else {
        const promptResp = await promptUser(AUTH_METHOD);
        authMethod = promptResp.authMethod;
      }

      await completeConfigSetup({
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
