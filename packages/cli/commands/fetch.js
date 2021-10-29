const { downloadFileOrFolder } = require('@hubspot/cli-lib/fileMapper');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  getAccountId,
  getMode,
  setLogLevel,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { validateAccount, validateMode } = require('../lib/validation');
const { logDebugInfo } = require('../lib/debugInfo');
const { trackCommandUsage } = require('../lib/usageTracking');
const { EXIT_CODES } = require('../lib/exitCodes');

exports.command = 'fetch <src> [dest]';
exports.describe =
  'Fetch a file, directory or module from HubSpot and write to a path on your computer';

exports.handler = async options => {
  const { config: configPath, src, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);

  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (
    !(
      validateConfig() &&
      (await validateAccount(options)) &&
      validateMode(options)
    )
  ) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    logger.error('A source to fetch is required');
    process.exit(EXIT_CODES.ERROR);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);

  trackCommandUsage('fetch', { mode }, accountId);

  // Fetch and write file/folder.
  downloadFileOrFolder({
    accountId,
    src,
    dest: resolveLocalPath(dest),
    mode,
    options,
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addOverwriteOptions(yargs, true);
  addModeOptions(yargs, { read: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: 'Path in HubSpot Design Tools',
    type: 'string',
  });

  yargs.positional('dest', {
    describe:
      'Local directory you would like the files to be placed in, relative to your current working directory',
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: 'Retrieve staged changes for project',
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  return yargs;
};
