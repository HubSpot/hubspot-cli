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
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cms-lib/lib/constants');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
const { updatePortalConfig } = require('@hubspot/cms-lib/lib/config');
const {
  addConfigOptions,
  addLoggerOptions,
  setLogLevel,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { promptUser, OAUTH_FLOW, PORTAL_NAME } = require('../lib/prompts');

const COMMAND_NAME = 'auth';
const ALLOWED_AUTH_METHODS = [
  OAUTH_AUTH_METHOD.value,
  PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
];

async function authAction(type, options) {
  const authType = type.toLowerCase();
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
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
      await authenticateWithOauth(configData);
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      configData = await personalAccessKeyPrompt();
      updatedConfig = await updateConfigWithPersonalAccessKey(configData);

      if (!updatedConfig.name) {
        promptAnswer = await promptUser([PORTAL_NAME]);
        updatePortalConfig({
          ...updatedConfig,
          environment: updatedConfig.env,
          tokenInfo: updatedConfig.auth.tokenInfo,
          name: promptAnswer.name,
        });
      }

      logger.success(
        `${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${PERSONAL_ACCESS_KEY_AUTH_METHOD.name}.`
      );
      break;
    default:
      logger.error(
        `Unsupported auth type: ${type}. The only supported authentication protocols are ${ALLOWED_AUTH_METHODS.join(
          ', '
        )}.`
      );
      break;
  }
  process.exit();
}

function configureAuthCommand(program) {
  program
    .version(version)
    .description('Configure authentication for a HubSpot account')
    .arguments('<type>')
    .action(authAction);

  addLoggerOptions(program);
  addConfigOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureAuthCommand,
};
