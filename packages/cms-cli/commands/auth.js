const { version } = require('../package.json');
const inquirer = require('inquirer');
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
const {
  PORTAL_NAME,
  PORTAL_ID,
  CLIENT_ID,
  CLIENT_SECRET,
} = require('../lib/prompts');

const COMMAND_NAME = 'auth';

const getAuthContext = async () => {
  const prompt = inquirer.createPromptModule();
  return prompt([PORTAL_NAME, PORTAL_ID, CLIENT_ID, CLIENT_SECRET]);
};

const setupOauth = (answers, portalId) => {
  const config = getPortalConfig(portalId) || {};
  return new OAuth2Manager(
    {
      ...answers,
      environment: config.env || 'prod',
      scopes: ['content'],
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
  const answers = await getAuthContext();
  const portalId = parseInt(answers.portalId, 10);
  const oauth = setupOauth(answers, portalId);

  trackCommandUsage(COMMAND_NAME);
  authorizeOauth(oauth);
  addOauthToPortalConfig(oauth, portalId);
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
