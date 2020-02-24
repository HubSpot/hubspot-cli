const { version } = require('../package.json');
const { loadConfig, validateConfig } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cms-lib/lib/constants');
const { authenticateWithOauth } = require('@hubspot/cms-lib/oauth');
const {
  personalAccessKeyPrompt,
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/personalAccessKey');
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
const { promptUser, OAUTH_FLOW } = require('../lib/prompts');

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

  if (!validateConfig()) {
    process.exit(1);
  }

  trackCommandUsage(COMMAND_NAME);
  let configData;
  switch (authType) {
    case OAUTH_AUTH_METHOD.value:
      configData = await promptUser(OAUTH_FLOW);
      await authenticateWithOauth(configData);
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      configData = await personalAccessKeyPrompt();
      await updateConfigWithPersonalAccessKey(configData);
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
