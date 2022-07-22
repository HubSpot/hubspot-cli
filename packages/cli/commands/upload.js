const fs = require('fs');
const path = require('path');

const {
  uploadFolder,
  hasUploadErrors,
  createTmpDir,
} = require('@hubspot/cli-lib');
const { getFileMapperQueryValues } = require('@hubspot/cli-lib/fileMapper');
const { upload } = require('@hubspot/cli-lib/api/fileMapper');
const {
  getCwd,
  convertToUnixPath,
  isAllowedExtension,
} = require('@hubspot/cli-lib/path');
const { convertFieldsJs } = require('@hubspot/cli-lib/lib/handleFieldsJs');
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
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { uploadPrompt } = require('../lib/prompts/uploadPrompt');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getThemePreviewUrl } = require('@hubspot/cli-lib/lib/files');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const i18nKey = 'cli.commands.upload';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'upload [--src] [--dest] [--option]';
exports.describe = i18n(`${i18nKey}.describe`);

const logThemePreview = (filePath, accountId) => {
  const previewUrl = getThemePreviewUrl(filePath, accountId);
  // Only log if we are actually in a theme
  if (previewUrl) {
    logger.log(
      i18n(`${i18nKey}.previewUrl`, {
        previewUrl,
      })
    );
  }
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  if (!validateMode(options)) {
    process.exit(EXIT_CODES.WARNING);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);

  const uploadPromptAnswers = await uploadPrompt(options);
  const processFields = options.processFields;
  const src = options.src || uploadPromptAnswers.src;
  let dest = options.dest || uploadPromptAnswers.dest;

  const absoluteSrcPath = path.resolve(getCwd(), src);
  const isFieldsJs = path.basename(absoluteSrcPath) == 'fields.js';
  let compiledJsonPath;
  let tmpDir;
  if (isFieldsJs && processFields) {
    // Write to a tmp folder, and change dest to have correct extension
    tmpDir = createTmpDir();
    compiledJsonPath = await convertFieldsJs(
      absoluteSrcPath,
      options.options,
      tmpDir
    );
    // Ensures that the dest path is a .json:
    dest = path.join(path.dirname(dest), 'fields.json');
  }
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
    process.exit(EXIT_CODES.WARNING);
  }
  if (stats.isFile()) {
    if (!isAllowedExtension(src)) {
      logger.error(
        i18n(`${i18nKey}.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }

    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(
        i18n(`${i18nKey}.errors.fileIgnored`, {
          path: src,
        })
      );
      return;
    }
    upload(
      accountId,
      isFieldsJs ? compiledJsonPath : absoluteSrcPath,
      normalizedDest,
      getFileMapperQueryValues({ mode, options })
    )
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.fileUploaded`, {
            accountId,
            dest: normalizedDest,
            src,
          })
        );
        logThemePreview(src, accountId);
      })
      .catch(error => {
        logger.error(
          i18n(`${i18nKey}.errors.uploadFailed`, {
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
        process.exit(EXIT_CODES.WARNING);
      })
      .finally(() => {
        if (isFieldsJs && processFields) {
          fs.rm(tmpDir, { recursive: true }, err => {
            if (err) {
              logger.error(
                'There was an error deleting the temporary project source'
              );
              throw err;
            }
          });
        }
      });
  } else {
    logger.log(
      i18n(`${i18nKey}.uploading`, {
        accountId,
        dest,
        src,
      })
    );
    uploadFolder(accountId, absoluteSrcPath, dest, {
      mode,
    })
      .then(results => {
        if (!hasUploadErrors(results)) {
          logger.success(
            i18n(`${i18nKey}.success.uploadComplete`, {
              dest,
            })
          );
          logThemePreview(src, accountId);
        } else {
          logger.error(
            i18n(`${i18nKey}.errors.someFilesFailed`, {
              dest,
            })
          );
          process.exit(EXIT_CODES.WARNING);
        }
      })
      .catch(error => {
        logger.error(
          i18n(`${i18nKey}.errors.uploadFailed`, {
            dest,
            src,
          })
        );
        logErrorInstance(error, {
          accountId,
        });
        process.exit(EXIT_CODES.WARNING);
      });
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addModeOptions(yargs, { write: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('options', {
    describe: i18n(`${i18nKey}.positionals.options.describe`),
    type: 'array',
    default: [''],
  });
  yargs.option('saveOutput', {
    describe: i18n(`${i18nKey}.positionals.options.saveOutput`),
    type: 'boolean',
    default: true,
  });
  yargs.option('processFields', {
    describe: i18n(`${i18nKey}.positionals.options.processFields`),
    type: 'boolean',
    default: false,
  });
  return yargs;
};
