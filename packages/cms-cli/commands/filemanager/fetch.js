const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { downloadFileOrFolder } = require('@hubspot/cms-lib/fileManager');
const { logger } = require('@hubspot/cms-lib/logger');
const { resolveLocalPath } = require('../../lib/filesystem');

const {
  addConfigOptions,
  addPortalOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validatePortal } = require('../../lib/validation');
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

  if (!validateConfig() || !(await validatePortal(options))) {
    process.exit(1);
  }

  if (typeof src !== 'string') {
    logger.error('A source to fetch is required');
    process.exit(1);
  }

  dest = resolveLocalPath(dest);

  const portalId = getPortalId(options);

  trackCommandUsage('filemanager-fetch', {}, portalId);

  // Fetch and write file/folder.
  downloadFileOrFolder(portalId, src, dest, options);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
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
