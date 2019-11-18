const { version } = require('../package.json');
const inquirer = require('inquirer');
const yaml = require('js-yaml');
const fs = require('fs');
const { logger } = require('@hubspot/cms-lib/logger');

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
const { PORTAL_API_KEY, PORTAL_ID, PORTAL_NAME } = require('../lib/prompts');

const COMMAND_NAME = 'init';
const HUBSPOT_CONFIG_YAML_FILE_NAME = 'hubspot.config.yaml';

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

const generateHubSpotConfigYAML = configData => {
  logger.log('Generating hubspot.config.yaml');
  fs.writeFileSync(
    HUBSPOT_CONFIG_YAML_FILE_NAME,
    yaml.safeDump(configData),
    'utf8',
    err => {
      if (err) logger.err(err);
    }
  );
};

function initializeConfigCommand(program) {
  program
    .version(version)
    .description('Initialize hubspot.config.yaml for a HubSpot portal')
    .arguments('[type]')
    .action(async (type, options) => {
      setLogLevel(options);
      logDebugInfo(options);

      const { portalName } = await promptUser(PORTAL_NAME);
      const { portalId } = await promptUser(PORTAL_ID);
      const { apiKey } = await promptUser(PORTAL_API_KEY);

      const configData = {
        defaultPortal: portalName,
        portals: [
          {
            name: portalName,
            portalId,
            authType: 'apikey',
            apiKey,
            env: 'PROD',
          },
        ],
      };

      generateHubSpotConfigYAML(configData);
      trackCommandUsage(COMMAND_NAME);
    });

  addLoggerOptions(program);
  addConfigOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
