const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const {
  watch,
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');

const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  addModeOptions,
  setLogLevel,
  getPortalId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validatePortal, validateMode } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'watch';
const DESCRIPTION =
  'Watch a directory on your computer for changes and upload the changed files to the HubSpot CMS';

const action = async ({ src, dest }, command = {}) => {
  setLogLevel(command);
  logDebugInfo(command);
  const {
    config: configPath,
    remove,
    initialUpload,
    disableInitial,
    notify,
  } = command;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (disableInitial) {
    logger.info(
      'Passing the "--disable-initial" option is no longer necessary. Running "hs watch" no longer uploads the watched directory by default.'
    );
  } else {
    logger.warn(
      `The "watch" command no longer uploads the watched directory by default. The directory "${src}" was not uploaded.`
    );
    logger.warn(
      'To upload the directory run "hs upload" or add the "--initial-upload" option when running "hs watch".'
    );
  }

  if (
    !(
      validateConfig() &&
      (await validatePortal(command)) &&
      validateMode(command)
    )
  ) {
    process.exit(1);
  }

  const portalId = getPortalId(command);
  const mode = getMode(command);

  const absoluteSrcPath = path.resolve(getCwd(), src);
  try {
    const stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      logger.log(`The "${src}" is not a path to a directory`);
      return;
    }
  } catch (e) {
    logger.log(`The "${src}" is not a path to a directory`);
    return;
  }

  if (!dest) {
    logger.log('A destination directory needs to be passed');
    return;
  }

  trackCommandUsage(COMMAND_NAME, { mode }, portalId);
  watch(portalId, absoluteSrcPath, dest, {
    mode,
    cwd: getCwd(),
    remove,
    disableInitial: initialUpload ? false : true,
    notify,
  });
};

// Yargs Configuration
const command = `${COMMAND_NAME} <src> <dest>`;
const describe = DESCRIPTION;
const builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addLoggerOptions(yargs, true);
  addModeOptions(yargs, { write: true }, true);

  yargs.positional('src', {
    describe: 'Local folder to watch',
    type: 'string',
    demand: true,
  });
  yargs.positional('dest', {
    describe: 'Remote folder to upload to',
    type: 'string',
    demand: true,
  });
  yargs.option('remove', {
    alias: 'r',
    describe: 'remove remote files when removed locally',
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: 'upload directory before watching for updates',
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    alias: 'd',
    describe: 'retrieve most recent log only',
    type: 'disable initial upload of watched directory (default)',
  });
  yargs.option('notify', {
    alias: 'n',
    describe:
      'Log to specified file when a watch task is triggered and after workers have gone idle. Ex. --notify path/to/file',
    type: 'string',
    requiresArg: true,
  });

  return yargs;
};
const handler = async argv => action({ src: argv.src, dest: argv.dest }, argv);

const configureCommanderWatchCommand = program => {
  program
    .version(version)
    .description(DESCRIPTION)
    .arguments('<src> <dest>')
    .option('--remove', 'remove remote files when removed locally')
    .option('--initial-upload', 'upload directory before watching for updates')
    .option(
      '--disable-initial',
      'disable initial upload of watched directory (default)'
    )
    .option(
      '--notify <path/to/file>',
      'log to specified file when a watch task is triggered and after workers have gone idle'
    )
    .action((src, dest) => action({ src, dest }, program));

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addModeOptions(program, { write: true });
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderWatchCommand,
};
