const { loadConfig, checkAndWarnGitInclusion } = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
  ENVIRONMENTS,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cli-lib/lib/constants');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const {
  updateAccountConfig,
  accountNameExistsInConfig,
  writeConfig,
  getConfigPath,
} = require('@hubspot/cli-lib/lib/config');
const { commaSeparatedValues } = require('@hubspot/cli-lib/lib/text');
const {
  promptUser,
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  API_KEY_FLOW,
  ACCOUNT_NAME,
} = require('../lib/prompts');
const {
  addConfigOptions,
  setLogLevel,
  addTestingOptions,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { trackCommandUsage } = require('../lib/usageTracking');
const { authenticateWithOauth } = require('../lib/oauth');

const ALLOWED_AUTH_METHODS = [
  OAUTH_AUTH_METHOD.value,
  PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
];
const SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT = commaSeparatedValues(
  ALLOWED_AUTH_METHODS
);

const promptForAccountNameIfNotSet = async updatedConfig => {
  if (!updatedConfig.name) {
    let promptAnswer;
    let validName = null;
    while (!validName) {
      promptAnswer = await promptUser([ACCOUNT_NAME]);

      if (!accountNameExistsInConfig(promptAnswer.name)) {
        validName = promptAnswer.name;
      } else {
        logger.log(
          `Account name "${promptAnswer.name}" already exists, please enter a different name.`
        );
      }
    }
    return validName;
  }
};

exports.command = 'auth [type]';
exports.describe = `Configure authentication for a HubSpot account. Supported authentication protocols are ${SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT}.`;

exports.handler = async options => {
  const { type, config: configPath, qa } = options;
  const authType =
    (type && type.toLowerCase()) || PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(options);
  logDebugInfo(options);

  if (!getConfigPath()) {
    logger.error(
      'No config file was found. To create a new config file, use the "hs init" command.'
    );
    process.exit(1);
  }

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  trackCommandUsage('auth');

  let configData;
  let updatedConfig;
  let validName;
  switch (authType) {
    case API_KEY_AUTH_METHOD.value:
      configData = await promptUser(API_KEY_FLOW);
      updatedConfig = await updateAccountConfig(configData);
      validName = await promptForAccountNameIfNotSet(updatedConfig);

      updateAccountConfig({
        ...updatedConfig,
        environment: updatedConfig.env,
        name: validName,
      });
      writeConfig();

      logger.success(
        `${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} updated with ${API_KEY_AUTH_METHOD.name}.`
      );

      break;
    case OAUTH_AUTH_METHOD.value:
      configData = await promptUser(OAUTH_FLOW);
      await authenticateWithOauth({
        ...configData,
        env,
      });
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      configData = await personalAccessKeyPrompt({ env });
      updatedConfig = await updateConfigWithPersonalAccessKey(configData);
      validName = await promptForAccountNameIfNotSet(updatedConfig);

      updateAccountConfig({
        ...updatedConfig,
        environment: updatedConfig.env,
        tokenInfo: updatedConfig.auth.tokenInfo,
        name: validName,
      });
      writeConfig();

      logger.success(
        `${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} updated with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
      );
      break;
    default:
      logger.error(
        `Unsupported auth type: ${type}. The only supported authentication protocols are ${SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT}.`
      );
      break;
  }
  process.exit();
};

exports.builder = yargs => {
  yargs.positional('type', {
    describe: 'Authentication mechanism',
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
