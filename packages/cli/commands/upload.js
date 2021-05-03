const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  uploadFolder,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { getFileMapperQueryValues } = require('@hubspot/cli-lib/fileMapper');
const { upload } = require('@hubspot/cli-lib/api/fileMapper');
const {
  getCwd,
  convertToUnixPath,
  isAllowedExtension,
} = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  logErrorInstance,
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('@hubspot/cli-lib/errorHandlers');
const { validateSrcAndDestPaths } = require('@hubspot/cli-lib/modules');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');

const {
  addConfigOptions,
  addAccountOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validateAccount, validateMode } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getThemePreviewUrl } = require('@hubspot/cli-lib/lib/files');

exports.command = 'upload <src> <dest>';
exports.describe =
  'Upload a folder or file from your computer to the HubSpot CMS';

const logThemePreview = (filePath, accountId) => {
  const previewUrl = getThemePreviewUrl(filePath, accountId);
  // Only log if we are actually in a theme
  if (previewUrl) {
    logger.log(`
      To preview this theme, visit:
      ${previewUrl}
      `);
  }
};

exports.handler = async options => {
  const { src, dest, config: configPath } = options;
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (
    !(
      validateConfig() &&
      (await validateAccount(options)) &&
      validateMode(options)
    )
  ) {
    process.exit(1);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);
  const absoluteSrcPath = path.resolve(getCwd(), src);
  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      logger.error(`The path "${src}" is not a path to a file or folder`);
      return;
    }
  } catch (e) {
    logger.error(`The path "${src}" is not a path to a file or folder`);
    return;
  }

  if (!dest) {
    logger.error('A destination path needs to be passed');
    return;
  }
  const normalizedDest = convertToUnixPath(dest);
  trackCommandUsage(
    'upload',
    { mode, type: stats.isFile() ? 'file' : 'folder' },
    accountId
  );
  const srcDestIssues = await validateSrcAndDestPaths(
    { isLocal: true, path: src },
    { isHubSpot: true, path: dest }
  );

  if (srcDestIssues.length) {
    srcDestIssues.forEach(({ message }) => logger.error(message));
    process.exit(1);
  }
  if (stats.isFile()) {
    if (!isAllowedExtension(src)) {
      logger.error(`The file "${src}" does not have a valid extension`);
      return;
    }

    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(`The file "${src}" is being ignored via an .hsignore rule`);
      return;
    }

    upload(
      accountId,
      absoluteSrcPath,
      normalizedDest,
      getFileMapperQueryValues({ mode, options })
    )
      .then(() => {
        logger.success(
          'Uploaded file from "%s" to "%s" in the Design Manager of account %s',
          src,
          normalizedDest,
          accountId
        );
        logThemePreview(src, accountId);
      })
      .catch(error => {
        logger.error('Uploading file "%s" to "%s" failed', src, normalizedDest);
        logApiUploadErrorInstance(
          error,
          new ApiErrorContext({
            accountId,
            request: normalizedDest,
            payload: src,
          })
        );
      });
  } else {
    logger.log(
      `Uploading files from "${src}" to "${dest}" in the Design Manager of account ${accountId}`
    );
    uploadFolder(accountId, absoluteSrcPath, dest, {
      mode,
    })
      .then(() => {
        logger.success(
          `Uploading files to "${dest}" in the Design Manager is complete`
        );
        logThemePreview(src, accountId);
      })
      .catch(error => {
        logger.error('Uploading failed');
        logErrorInstance(error, {
          accountId,
        });
      });
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addModeOptions(yargs, { write: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe:
      'Path to the local file, relative to your current working directory.',
    type: 'string',
  });
  yargs.positional('dest', {
    describe: 'Path in HubSpot Design Tools, can be a net new path.',
    type: 'string',
  });
  return yargs;
};
