const {
  lint,
  printHublValidationResult,
} = require('@hubspot/cms-lib/validate');
const {
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
  getPortalId,
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

const action = async (args, options) => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }

  const portalId = getPortalId(options);

  trackCommandUsage(COMMAND_NAME, {}, portalId);

  const localPath = resolveLocalPath(args.localPath);
  const groupName = `Linting "${localPath}"`;

  logger.group(groupName);
  let count = 0;
  try {
    await lint(portalId, localPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logErrorInstance(err, { portalId });
    process.exit(1);
  }
  logger.groupEnd(groupName);
  logger.log('%d issues found', count);
};

const configureYargs = {
  command: `${COMMAND_NAME} <path>`,
  describe: DESCRIPTION,
  builder: yargs => {
    addConfigOptions(yargs, true);
    addPortalOptions(yargs, true);
    yargs.positional('path', {
      describe: 'Local folder to lint',
      type: 'string',
    });
    return yargs;
  },
  handler: async argv => {
    await action({ localPath: argv.path }, argv);
  },
};

// Commander.js
const configureLintCommand = program => {
  program
    .version(version)
    .description(DESCRIPTION)
    .arguments('<path>')
    .action(async (localPath, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }

      await action({ localPath }, command);
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = { ...configureYargs, configureLintCommand };
