const { version } = require('../package.json');
const {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  writeConfig,
} = require('@hubspot/cms-lib/lib/config');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('@hubspot/cms-lib/lib/constants');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
const {
  promptUser,
  personalAccessKeyPrompt,
  PORTAL_NAME,
  OAUTH_FLOW,
  API_KEY_FLOW,
} = require('@hubspot/cms-lib/lib/prompts');
const {
  trackCommandUsage,
  addHelpUsageTracking,
  trackAuthAction,
} = require('../lib/usageTracking');
const {
  addLoggerOptions,
  setLogLevel,
  addTestingOptions,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { updatePortalConfig } = require('@hubspot/cms-lib/lib/config');
const { authenticateWithOauth } = require('../lib/oauth');

const COMMAND_NAME = 'init';
const DESCRIPTION = `initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal`;
const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};
const VALID_AUTH_TYPES = [
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
].map(a => a.value);

const personalAccessKeyConfigCreationFlow = async env => {
  const configData = await personalAccessKeyPrompt({ env });
  const { name } = await promptUser([PORTAL_NAME]);
  const portalConfig = {
    ...configData,
    name,
  };

  await updateConfigWithPersonalAccessKey(portalConfig, true);
  return portalConfig;
};

const oauthConfigCreationFlow = async env => {
  const configData = await promptUser(OAUTH_FLOW);
  const portalConfig = {
    ...configData,
    env,
  };
  await authenticateWithOauth(portalConfig);
  return portalConfig;
};

const apiKeyConfigCreationFlow = async env => {
  const configData = await promptUser(API_KEY_FLOW);
  const portalConfig = {
    ...configData,
    env,
  };
  updatePortalConfig(portalConfig);
  writeConfig();
  return portalConfig;
};

const CONFIG_CREATION_FLOWS = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: personalAccessKeyConfigCreationFlow,
  [OAUTH_AUTH_METHOD.value]: oauthConfigCreationFlow,
  [API_KEY_AUTH_METHOD.value]: apiKeyConfigCreationFlow,
};

const action = async options => {
  const { auth: authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value } = options;
  const configPath = getConfigPath();
  setLogLevel(options);
  logDebugInfo(options);
  if (VALID_AUTH_TYPES.indexOf(authType) === -1) {
    logger.error(
      `The auth type '${authType}' is invalid. Valid types are: ${VALID_AUTH_TYPES.join(
        ', '
      )}.`
    );
    process.exit(1);
  }

  trackCommandUsage(COMMAND_NAME, {
    authType,
  });
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  if (configPath) {
    logger.error(`The config file '${configPath}' already exists.`);
    logger.info(
      'To update an existing config file, use the "hs auth" command.'
    );
    process.exit(1);
  }

  trackAuthAction(COMMAND_NAME, authType, TRACKING_STATUS.STARTED);

  createEmptyConfigFile();
  handleExit(deleteEmptyConfigFile);

  try {
    const { portalId } = await CONFIG_CREATION_FLOWS[authType](env);
    const path = getConfigPath();

    logger.success(
      `The config file "${path}" was created using your personal access key for portal ${portalId}.`
    );

    trackAuthAction(COMMAND_NAME, authType, TRACKING_STATUS.COMPLETE, portalId);
    process.exit();
  } catch (err) {
    logErrorInstance(err);
    trackAuthAction(COMMAND_NAME, authType, TRACKING_STATUS.ERROR);
  }
};

// Yargs Configuration
const command = `${COMMAND_NAME}`;
const describe = DESCRIPTION;
const builder = yargs => {
  yargs.option('auth', {
    describe:
      'specify auth method to use ["personalaccesskey", "oauth2", "apikey"]',
    type: 'string',
  });
  addTestingOptions(yargs, true);

  return yargs;
};
const handler = async argv => action(argv);

// Commander Configuration
const configureCommanderInitCommand = program => {
  program
    .version(version)
    .description(DESCRIPTION)
    .option(
      '--auth',
      'specify auth method to use ["personalaccesskey", "oauth2", "apikey"]'
    )
    .action(async (command = {}) => action(command));

  addLoggerOptions(program);
  addTestingOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderInitCommand,
};
