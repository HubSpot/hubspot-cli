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
  ENVIRONMENTS,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cms-lib/lib/constants');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
const {
  updatePortalConfig,
  portalNameExistsInConfig,
  writeConfig,
} = require('@hubspot/cms-lib/lib/config');
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
const {
  promptUser,
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  PORTAL_NAME,
} = require('../lib/prompts');
const { commaSeparatedValues } = require('../lib/text');

const COMMAND_NAME = 'auth';
const ALLOWED_AUTH_METHODS = [
  OAUTH_AUTH_METHOD.value,
  PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
];
const SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT = commaSeparatedValues(
  ALLOWED_AUTH_METHODS
);

async function authAction(type, options) {
  const authType = type.toLowerCase();
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
  let promptAnswer;
  switch (authType) {
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

      if (!updatedConfig.name) {
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

        updatePortalConfig({
          ...updatedConfig,
          environment: updatedConfig.env,
          tokenInfo: updatedConfig.auth.tokenInfo,
          name: validName,
        });
        writeConfig();
      }

      logger.success(
        `${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
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

function configureAuthCommand(program) {
  program
    .version(version)
    .description(
      `Configure authentication for a HubSpot account. Supported authentication protocols are ${SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT}.`
    )
    .arguments('<type>')
    .action(authAction);

  addLoggerOptions(program);
  addConfigOptions(program);
  addTestingOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureAuthCommand,
};
