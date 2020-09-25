const { version } = require('../package.json');
const {
  getConfigPath,
  getPortalId,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} = require('@hubspot/cms-lib/lib/config');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('@hubspot/cms-lib/lib/constants');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cms-lib/updateConfigWithPersonalAccessKey');
const {
  promptUser,
  personalAccessKeyPrompt,
  PORTAL_NAME,
} = require('../lib/prompts');
const {
  trackCommandUsage,
  addHelpUsageTracking,
  trackAuthAction,
} = require('../lib/usageTracking');
const {
  addLoggerOptions,
  setLogLevel,
  addTestingOptions,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

const COMMAND_NAME = 'init';
const DESCRIPTION = `initialize ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} for a HubSpot portal`;
const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const action = async options => {
  const configPath = getConfigPath();
  setLogLevel(options);
  logDebugInfo(options);
  trackCommandUsage(COMMAND_NAME, { authType: 'personalaccesskey' });
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  if (configPath) {
    logger.error(`The config file '${configPath}' already exists.`);
    logger.info(
      'To update an existing config file, use the "hs auth" command.'
    );
    process.exit(1);
  }

  trackAuthAction(
    COMMAND_NAME,
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    TRACKING_STATUS.STARTED
  );

  createEmptyConfigFile();
  handleExit(deleteEmptyConfigFile);

  try {
    const configData = await personalAccessKeyPrompt({ env });
    const { name } = await promptUser([PORTAL_NAME]);

    await updateConfigWithPersonalAccessKey(
      {
        ...configData,
        name,
      },
      true
    );

    const path = getConfigPath();
    const portalId = getPortalId();

    logger.success(
      `The config file "${path}" was created using your personal access key for portal ${portalId}.`
    );

    trackAuthAction(
      COMMAND_NAME,
      PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
      TRACKING_STATUS.COMPLETE,
      portalId
    );
  } catch (err) {
    logErrorInstance(err);
    trackAuthAction(
      COMMAND_NAME,
      PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
      TRACKING_STATUS.ERROR
    );
  }
};

// Yargs Configuration
const command = `${COMMAND_NAME}`;
const describe = DESCRIPTION;
const builder = yargs => {
  addTestingOptions(yargs, true);

  return yargs;
};
const handler = async argv => action(argv);

// Commander Configuration
const configureCommanderInitCommand = program => {
  program
    .version(version)
    .description(DESCRIPTION)
    .action(async (command = {}) => action(command));

  addLoggerOptions(program);
  addTestingOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderInitCommand,
};
