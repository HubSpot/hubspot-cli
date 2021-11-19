const path = require('path');
const fs = require('fs-extra');
const {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  updateDefaultAccount,
  writeConfig,
  updateAccountConfig,
} = require('@hubspot/cli-lib/lib/config');
const { addConfigOptions } = require('../lib/commonOpts');
const { handleExit } = require('@hubspot/cli-lib/lib/process');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('@hubspot/cli-lib/lib/constants');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { getCwd } = require('@hubspot/cli-lib/path');
const { trackCommandUsage, trackAuthAction } = require('../lib/usageTracking');
const { setLogLevel, addTestingOptions } = require('../lib/commonOpts');
const {
  OAUTH_FLOW,
  API_KEY_FLOW,
  ACCOUNT_NAME,
  personalAccessKeyPrompt,
  promptUser,
} = require('../lib/prompts');
const { logDebugInfo } = require('../lib/debugInfo');
const { authenticateWithOauth } = require('../lib/oauth');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const personalAccessKeyConfigCreationFlow = async env => {
  const configData = await personalAccessKeyPrompt({ env });
  const { name } = await promptUser([ACCOUNT_NAME]);
  const accountConfig = {
    ...configData,
    name,
  };

  return updateConfigWithPersonalAccessKey(accountConfig, true);
};

const oauthConfigCreationFlow = async env => {
  const configData = await promptUser(OAUTH_FLOW);
  const accountConfig = {
    ...configData,
    env,
  };
  await authenticateWithOauth(accountConfig);
  updateDefaultAccount(accountConfig.name);
  return accountConfig;
};

const apiKeyConfigCreationFlow = async env => {
  const configData = await promptUser(API_KEY_FLOW);
  const accountConfig = {
    ...configData,
    env,
  };
  updateAccountConfig(accountConfig);
  updateDefaultAccount(accountConfig.name);
  writeConfig();
  return accountConfig;
};

const CONFIG_CREATION_FLOWS = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: personalAccessKeyConfigCreationFlow,
  [OAUTH_AUTH_METHOD.value]: oauthConfigCreationFlow,
  [API_KEY_AUTH_METHOD.value]: apiKeyConfigCreationFlow,
};

exports.command = 'init';
exports.describe = `initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot account`;

exports.handler = async options => {
  const { auth: authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value, c } = options;
  const configPath = (c && path.join(getCwd(), c)) || getConfigPath();
  setLogLevel(options);
  logDebugInfo(options);
  trackCommandUsage('init', {
    authType,
  });
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  if (fs.existsSync(configPath)) {
    logger.error(`The config file '${configPath}' already exists.`);
    logger.info(
      'To update an existing config file, use the "hs auth" command.'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  trackAuthAction('init', authType, TRACKING_STATUS.STARTED);
  createEmptyConfigFile({ path: configPath });
  handleExit(deleteEmptyConfigFile);

  try {
    const { accountId, name } = await CONFIG_CREATION_FLOWS[authType](env);
    const configPath = getConfigPath();

    logger.success(
      `The config file "${configPath}" was created using "${authType}" for account ${name ||
        accountId}.`
    );

    trackAuthAction('init', authType, TRACKING_STATUS.COMPLETE, accountId);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logErrorInstance(err);
    trackAuthAction('init', authType, TRACKING_STATUS.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('auth', {
    describe:
      'specify auth method to use ["personalaccesskey", "oauth2", "apikey"]',
    type: 'string',
    choices: [
      `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
      `${OAUTH_AUTH_METHOD.value}`,
      `${API_KEY_AUTH_METHOD.value}`,
    ],
    default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    defaultDescription: `"${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}": \nAn access token tied to a specific user account. This is the recommended way of authenticating with local development tools.`,
  });

  addConfigOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
