// @ts-nocheck
const fs = require('fs');
const path = require('path');

const { uploadFolder } = require('@hubspot/local-dev-lib/fileManager');
const { uploadFile } = require('@hubspot/local-dev-lib/api/fileManager');
const { getCwd, convertToUnixPath } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  validateSrcAndDestPaths,
} = require('@hubspot/local-dev-lib/cms/modules');
const { shouldIgnoreFile } = require('@hubspot/local-dev-lib/ignoreRules');

const { ApiErrorContext, logError } = require('../../lib/errorHandlers/index');
const {
  addConfigOptions,
  addGlobalOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.filemanager.subcommands.upload';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'upload <src> <dest>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest, derivedAccountId } = options;

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
    derivedAccountId
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

    uploadFile(derivedAccountId, absoluteSrcPath, normalizedDest)
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.upload`, {
            accountId: derivedAccountId,
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
        logError(
          error,
          new ApiErrorContext({
            accountId: derivedAccountId,
            request: normalizedDest,
            payload: src,
          })
        );
      });
  } else {
    logger.log(
      i18n(`${i18nKey}.logs.uploading`, {
        accountId: derivedAccountId,
        dest,
        src,
      })
    );
    uploadFolder(derivedAccountId, absoluteSrcPath, dest)
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.uploadComplete`, {
            dest,
          })
        );
      })
      .catch(error => {
        logger.error(i18n(`${i18nKey}.errors.uploadingFailed`));
        logError(error, {
          accountId: derivedAccountId,
        });
      });
  }
};

exports.builder = yargs => {
  addGlobalOptions(yargs);
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};
