const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { downloadFileOrFolder } = require('@hubspot/cli-lib/fileManager');
const { logger } = require('@hubspot/cli-lib/logger');
const { resolveLocalPath } = require('../../lib/filesystem');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

exports.command = 'fetch <src> [dest]';
exports.describe =
  'Download a folder or file from the HubSpot File Manager to your computer';

exports.handler = async options => {
  let { config: configPath, src, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!validateConfig() || !(await validateAccount(options))) {
    process.exit(1);
  }

  if (typeof src !== 'string') {
    logger.error('A source to fetch is required');
    process.exit(1);
  }

  dest = resolveLocalPath(dest);

  const accountId = getAccountId(options);

  trackCommandUsage('filemanager-fetch', {}, accountId);

  // Fetch and write file/folder.
  downloadFileOrFolder(accountId, src, dest, options);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: 'Path in HubSpot Design Tools',
    type: 'string',
  });
  yargs.positional('dest', {
    describe:
      'Path to the local directory you would like the files to be placed, relative to your current working directory. If omitted, this argument will default to your current working directory',
    type: 'string',
  });
  yargs.option('include-archived', {
    alias: ['i'],
    describe: 'Include files that have been marked as "archived"',
    type: 'boolean',
  });
};
