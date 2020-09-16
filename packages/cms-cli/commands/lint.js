const {
  lint,
  printHublValidationResult,
} = require('@hubspot/cms-lib/validate');
const {
  getPortalId,
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { version } = require('../package.json');
const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  setLogLevel,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { validatePortal } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'lint';
const DESCRIPTION = 'Lint a file or folder for HubL syntax';

const loadAndValidateOptions = async command => {
  setLogLevel(command);
  logDebugInfo(command);
  const { config: configPath } = command;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(command)))) {
    process.exit(1);
  }
};

const action = async ({ localPath }, command) => {
  await loadAndValidateOptions(command);

  const portalId = getPortalId(command);
  const resolvedLocalPath = resolveLocalPath(localPath);
  const groupName = `Linting "${resolvedLocalPath}"`;

  trackCommandUsage(COMMAND_NAME, {}, command);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(portalId, resolvedLocalPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logErrorInstance(err, { portalId });
    process.exit(1);
  }
  logger.groupEnd(groupName);
  logger.log(`${count} issues found`);
};

// Yargs Configuration
const command = `${COMMAND_NAME} <path>`;
const describe = DESCRIPTION;
const builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs.positional('path', {
    describe: 'Local folder to lint',
    type: 'string',
  });
  return yargs;
};
const handler = async argv => action({ localPath: argv.path }, argv);

// Commander Configuration
const configureCommanderLintCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .arguments('<path>')
    .action(async (localPath, command = {}) => action({ localPath }, command));

  addConfigOptions(commander);
  addPortalOptions(commander);
  addLoggerOptions(commander);
  addHelpUsageTracking(commander, COMMAND_NAME);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderLintCommand,
};
