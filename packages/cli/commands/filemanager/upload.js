const fs = require('fs');
const path = require('path');

const { uploadFolder } = require('@hubspot/cli-lib/fileManager');
const { uploadFile } = require('@hubspot/cli-lib/api/fileManager');
const { getCwd, convertToUnixPath } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('../../lib/errorHandlers/apiErrors');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { validateSrcAndDestPaths } = require('@hubspot/cli-lib/modules');
const { shouldIgnoreFile } = require('@hubspot/local-dev-lib/ignoreRules');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.filemanager.subcommands.upload';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'upload <src> <dest>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const absoluteSrcPath = path.resolve(getCwd(), src);

  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      logger.error(
        i18n(`${i18nKey}.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!dest) {
    logger.error(i18n(`${i18nKey}.errors.destinationRequired`));
    return;
  }
  const normalizedDest = convertToUnixPath(dest);
  trackCommandUsage(
    'filemanager-upload',
    { type: stats.isFile() ? 'file' : 'folder' },
    accountId
  );

  const srcDestIssues = await validateSrcAndDestPaths(
    { isLocal: true, path: src },
    { isHubSpot: true, path: dest }
  );
  if (srcDestIssues.length) {
    srcDestIssues.forEach(({ message }) => logger.error(message));
    process.exit(EXIT_CODES.ERROR);
  }

  if (stats.isFile()) {
    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(
        i18n(`${i18nKey}.errors.fileIgnored`, {
          path: src,
        })
      );
      return;
    }

    uploadFile(accountId, absoluteSrcPath, normalizedDest)
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.upload`, {
            accountId,
            dest: normalizedDest,
            src,
          })
        );
      })
      .catch(error => {
        logger.error(
          i18n(`${i18nKey}.errors.upload`, {
            dest: normalizedDest,
            src,
          })
        );
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
      i18n(`${i18nKey}.logs.uploading`, {
        accountId,
        dest,
        src,
      })
    );
    uploadFolder(accountId, absoluteSrcPath, dest)
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.uploadComplete`, {
            dest,
          })
        );
      })
      .catch(error => {
        logger.error(i18n(`${i18nKey}.errors.uploadingFailed`));
        logErrorInstance(error, {
          accountId,
        });
      });
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};
