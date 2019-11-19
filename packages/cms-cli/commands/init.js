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
  try {
    fs.writeFileSync(HUBSPOT_CONFIG_YAML_FILE_NAME, yaml.safeDump(configData));
    logger.log('Successfully generated hubspot.config.yaml');
  } catch (e) {
    logger.error(e);
  }
};

const generateConfigData = ({ portalName, portalId, apiKey }) => {
  logger.log('Generating config data');
  return {
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
};

function initializeConfigCommand(program) {
  program
    .version(version)
    .description('Initialize hubspot.config.yaml for a HubSpot portal')
    .action(async options => {
      setLogLevel(options);
      logDebugInfo(options);

      if (fs.existsSync(HUBSPOT_CONFIG_YAML_FILE_NAME)) {
        const configFileExistsError = `The config file '${process.cwd()}/${HUBSPOT_CONFIG_YAML_FILE_NAME}' already exists.`;

        logger.error(configFileExistsError);
        process.exit(1);
      }

      const { portalName } = await promptUser(PORTAL_NAME);
      const { portalId } = await promptUser(PORTAL_ID);
      const { apiKey } = await promptUser(PORTAL_API_KEY);

      const configData = generateConfigData({
        portalName,
        portalId,
        apiKey,
      });

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
