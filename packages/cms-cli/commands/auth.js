const { version } = require('../package.json');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
  ENVIRONMENTS,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cms-lib/lib/constants');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
const {
  updatePortalConfig,
  portalNameExistsInConfig,
  writeConfig,
} = require('@hubspot/cms-lib/lib/config');
const {
  promptUser,
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  API_KEY_FLOW,
  PORTAL_NAME,
} = require('@hubspot/cms-lib/lib/prompts');
const {
  addConfigOptions,
  addLoggerOptions,
  setLogLevel,
  addTestingOptions,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { commaSeparatedValues } = require('../lib/text');
const { authenticateWithOauth } = require('../lib/oauth');

const COMMAND_NAME = 'auth';
const ALLOWED_AUTH_METHODS = [
  OAUTH_AUTH_METHOD.value,
  PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
];
const SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT = commaSeparatedValues(
  ALLOWED_AUTH_METHODS
);

const promptForPortalNameIfNotSet = async updatedConfig => {
  if (!updatedConfig.name) {
    let promptAnswer;
    let validName = null;
    while (!validName) {
      promptAnswer = await promptUser([PORTAL_NAME]);

      if (!portalNameExistsInConfig(promptAnswer.name)) {
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

async function authAction(type, options) {
  const authType =
    (type && type.toLowerCase()) || PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  loadConfig(configPath, {
    ignoreEnvironmentVariableConfig: true,
  });
  checkAndWarnGitInclusion();

  if (!validateConfig()) {
    process.exit(1);
  }

  trackCommandUsage(COMMAND_NAME);
  let configData;
  let updatedConfig;
  let validName;
  switch (authType) {
    case API_KEY_AUTH_METHOD.value:
      configData = await promptUser(API_KEY_FLOW);
      updatedConfig = await updatePortalConfig(configData);
      validName = await promptForPortalNameIfNotSet(updatedConfig);

      updatePortalConfig({
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
      validName = await promptForPortalNameIfNotSet(updatedConfig);

      updatePortalConfig({
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
}

const DESCRIPTION = `Configure authentication for a HubSpot account. Supported authentication protocols are ${SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT}.`;

// Yargs Configuration
const command = `${COMMAND_NAME} [type]`;
const describe = DESCRIPTION;
const builder = yargs => {
  yargs.positional('[type]', {
    describe: 'Authentication mechanism',
    type: 'string',
    choices: [
      `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
      `${OAUTH_AUTH_METHOD.value}`,
    ],
    default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    defaultDescription: `"${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}": \nAn API Key tied to a specific user account. This is the recommended way of authenticating with local development tools.`,
  });

  addConfigOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
const handler = async argv => authAction(argv.type, argv);

// Commander Configuration
function configureCommanderAuthCommand(program) {
  program
    .version(version)
    .description(DESCRIPTION)
    .arguments('[type]')
    .action(authAction);

  addLoggerOptions(program);
  addConfigOptions(program);
  addTestingOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderAuthCommand,
};
