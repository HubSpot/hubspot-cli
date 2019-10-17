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

const getAuthContext = async () => {
  const prompt = inquirer.createPromptModule();
  return prompt([
    {
      name: 'portalId',
      message: 'Enter the HubSpot CMS portal ID:',
      type: 'number',
      validate(val) {
        if (!Number.isNaN(val) && val > 0) {
          return true;
        }
        return 'A HubSpot portal ID must be provided.';
      },
    },
    {
      name: 'clientId',
      message: 'Enter your OAuth2 client ID:',
      validate(val) {
        if (typeof val !== 'string' || val.length !== 36) {
          return 'The OAuth2 client ID is 36 characters long. Please try again.';
        }
        return true;
      },
    },
    {
      name: 'clientSecret',
      message: 'Enter your OAuth2 client secret:',
      validate(val) {
        if (typeof val !== 'string' || val.length !== 36) {
          return 'The OAuth2 client secret is 36 characters long. Please try again.';
        } else if (val[0] === '*') {
          return 'Please copy actual OAuth2 client secret not the asterisks used to hide it.';
        }
        return true;
      },
    },
  ]);
};

const COMMAND_NAME = 'auth';

function configureAuthCommand(program) {
  program
    .version(version)
    .description('Configure authentication for a HubSpot account')
    .arguments('<type>')
    .action(async (type, options) => {
      setLogLevel(options);
      logDebugInfo(options);
      const { config: configPath } = options;
      loadConfig(configPath);

      if (!validateConfig()) {
        process.exit(1);
      }

      if (type !== 'oauth2') {
        logger.error("The only supported authentication protocol is 'oauth2'");
        return;
      }
      const answers = await getAuthContext();
      const portalId = parseInt(answers.portalId, 10);
      const config = getPortalConfig(portalId) || {};
      const oauth = new OAuth2Manager(
        {
          ...answers,
          environment: config.env || 'prod',
          scopes: ['content'],
        },
        logger
      );
      trackCommandUsage(COMMAND_NAME);
      logger.log('Authorizing');
      await oauth.authorize();
      logger.log('Updating configuration');
      try {
        updatePortalConfig({
          ...oauth.toObj(),
          authType: 'oauth2',
          portalId: answers.portalId,
        });
        logger.log('Configuration updated');
      } catch (err) {
        logErrorInstance(err);
      }
    });

  addLoggerOptions(program);
  addConfigOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureAuthCommand,
};
