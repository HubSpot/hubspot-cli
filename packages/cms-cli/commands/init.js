const { version } = require('../package.json');
const inquirer = require('inquirer');
const {
  getConfigPath,
  writeNewPortalApiKeyConfig,
} = require('@hubspot/cms-lib/lib/config');
const {
  logFileSystemErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { PORTAL_API_KEY, PORTAL_ID, PORTAL_NAME } = require('../lib/prompts');

const COMMAND_NAME = 'init';

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

function initializeConfigCommand(program) {
  program
    .version(version)
    .description('Initialize hubspot.config.yaml for a HubSpot portal')
    .action(async options => {
      setLogLevel(options);
      logDebugInfo(options);

      const configPath = getConfigPath();

      if (configPath) {
        const configFileExistsError = `The config file '${configPath}' already exists.`;

        logFileSystemErrorInstance(configFileExistsError, {
          filepath: configPath,
        });
        process.exit(1);
      }

      writeNewPortalApiKeyConfig(
        await promptUser([PORTAL_NAME, PORTAL_ID, PORTAL_API_KEY])
      );
      trackCommandUsage(COMMAND_NAME);
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
