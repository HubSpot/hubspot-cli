const { version } = require('../package.json');
const OAuth2Manager = require('@hubspot/api-auth-lib/OAuth2Manager');
const {
  loadConfig,
  getPortalConfig,
  updatePortalConfig,
} = require('@hubspot/cms-lib');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { logger } = require('@hubspot/cms-lib/logger');
const { AUTH_METHODS } = require('@hubspot/cms-lib/lib/constants');

const { validateConfig } = require('../lib/validation');
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
const REQUIRED_SCOPES = ['content'];

const setupOauth = (answers, portalId) => {
  const config = getPortalConfig(portalId) || {};
  return new OAuth2Manager(
    {
      ...answers,
      environment: config.env || 'prod',
      scopes: REQUIRED_SCOPES,
    },
    logger
  );
};

const authorizeOauth = async oauth => {
  logger.log('Authorizing');
  await oauth.authorize();
};

const addOauthToPortalConfig = (oauth, portalId) => {
  logger.log('Updating configuration');
  try {
    updatePortalConfig({
      ...oauth.toObj(),
      authType: AUTH_METHODS.oauth.value,
      portalId,
    });
    logger.log('Configuration updated');
    process.exit();
  } catch (err) {
    logErrorInstance(err);
  }
};

const addNewAuthorizedOauthToConfig = async () => {
  const answers = await promptUser(OAUTH_FLOW);
  const portalId = parseInt(answers.portalId, 10);
  const oauth = setupOauth(answers, portalId);

  await authorizeOauth(oauth);
  addOauthToPortalConfig(oauth, portalId);
};

async function authAction(type, options) {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);

  if (!validateConfig()) {
    process.exit(1);
  }

  if (type !== AUTH_METHODS.oauth.value) {
    logger.error(
      `The only supported authentication protocol is '${AUTH_METHODS.oauth.value}'`
    );
    return;
  }

  trackCommandUsage(COMMAND_NAME);
  await addNewAuthorizedOauthToConfig();
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
  authAction,
};
