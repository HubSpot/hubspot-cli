const { version } = require('../package.json');
const inquirer = require('inquirer');
const { spawn } = require('child_process');
const {
  getConfigPath,
  writeNewPortalApiKeyConfig,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} = require('@hubspot/cms-lib/lib/config');
const {
  logFileSystemErrorInstance,
  logErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cms-lib/lib/constants');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { PORTAL_API_KEY, PORTAL_ID, PORTAL_NAME } = require('../lib/prompts');
const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'init';
const HS_AUTH_OAUTH_COMMAND = 'hs auth oauth2';
const SPLIT_ON_CAPITALS_REGEX = /(?=[A-Z])/;
const AUTH_METHODS = {
  oauth: 'oauth2',
  api: 'apiKey',
};
const AUTH_DESCRIPTIONS = {
  [AUTH_METHODS.oauth]: `Initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} using ${AUTH_METHODS.oauth}`,
  [AUTH_METHODS.api]: `Initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} using ${AUTH_METHODS.api}`,
};

const AUTH_METHOD_PROMPT_CONFIG = {
  type: 'list',
  name: 'authMethod',
  message: 'Choose authentication method',
  default: AUTH_METHODS.oauth,
  choices: Object.keys(AUTH_METHODS).map(method => {
    const authMethod = AUTH_METHODS[method];
    return {
      value: authMethod,
      name: authMethod
        .split(SPLIT_ON_CAPITALS_REGEX)
        .join(' ')
        .toLowerCase(),
    };
  }),
};

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

const oauthConfigSetup = () => {
  try {
    createEmptyConfigFile();
    const authProcess = spawn(HS_AUTH_OAUTH_COMMAND, {
      stdio: 'inherit',
      shell: true,
    });

    authProcess.on('close', deleteEmptyConfigFile);
  } catch (e) {
    logErrorInstance(e, HS_AUTH_OAUTH_COMMAND);
  }

  trackCommandUsage(COMMAND_NAME, {
    authType: AUTH_METHODS.oauth,
  });
};

const apiKeyConfigSetup = async ({ configPath }) => {
  const configData = await promptUser([PORTAL_NAME, PORTAL_ID, PORTAL_API_KEY]);

  try {
    writeNewPortalApiKeyConfig(configData);
  } catch (err) {
    logFileSystemErrorInstance(err, {
      filepath: configPath,
      configData,
    });
  }

  trackCommandUsage(COMMAND_NAME, {
    authType: AUTH_METHODS.api,
  });
};

function initializeConfigCommand(program) {
  program
    .version(version)
    .description(
      `Initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal`
    )
    .option('--api', AUTH_DESCRIPTIONS.api)
    .option('--oauth', AUTH_DESCRIPTIONS.oauth)
    .action(async options => {
      setLogLevel(options);
      logDebugInfo(options);

      const configPath = getConfigPath();
      let authMethod;

      if (configPath) {
        logger.error(`The config file '${configPath}' already exists.`);
        process.exit(1);
      }

      if (!options.api && !options.oauth) {
        ({ authMethod } = await promptUser(AUTH_METHOD_PROMPT_CONFIG));
      }

      if (options.api || authMethod === AUTH_METHODS.api) {
        apiKeyConfigSetup({
          configPath,
        });
      } else if (options.oauth || authMethod === AUTH_METHODS.oauth) {
        oauthConfigSetup({
          options,
        });
      } else {
        logErrorInstance('Unrecognized auth method passed to hs init');
      }
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  initializeConfigCommand,
};
