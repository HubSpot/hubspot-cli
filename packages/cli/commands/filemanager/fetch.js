const { downloadFileOrFolder } = require('@hubspot/cli-lib/fileManager');
const { logger } = require('@hubspot/cli-lib/logger');
const { resolveLocalPath } = require('../../lib/filesystem');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'fetch <src> [dest]';
exports.describe =
  'Download a folder or file from the HubSpot File Manager to your computer';

exports.handler = async options => {
  let { src, dest } = options;

  await loadAndValidateOptions(options);

  if (typeof src !== 'string') {
    logger.error('A source to fetch is required');
    process.exit(EXIT_CODES.ERROR);
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
