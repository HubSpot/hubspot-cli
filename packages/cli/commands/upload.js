const fs = require('fs');
const path = require('path');
const { uploadFolder, hasUploadErrors } = require('@hubspot/cli-lib');
const { getFileMapperQueryValues } = require('@hubspot/cli-lib/fileMapper');
const { upload, deleteFile } = require('@hubspot/cli-lib/api/fileMapper');
const {
  getCwd,
  convertToUnixPath,
  isAllowedExtension,
} = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('../lib/errorHandlers/apiErrors');
const { logErrorInstance } = require('../lib/errorHandlers/standardErrors');
const { validateSrcAndDestPaths } = require('@hubspot/cli-lib/modules');
const { shouldIgnoreFile } = require('@hubspot/local-dev-lib/ignoreRules');

const {
  addConfigOptions,
  addAccountOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { uploadPrompt } = require('../lib/prompts/uploadPrompt');
const { cleanUploadPrompt } = require('../lib/prompts/cleanUploadPrompt');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getUploadableFileList } = require('../lib/upload');
const {
  getThemePreviewUrl,
  getThemeJSONPath,
} = require('@hubspot/local-dev-lib/cms/themes');
const { i18n } = require('../lib/lang');
const i18nKey = 'cli.commands.upload';
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const {
  FieldsJs,
  isConvertableFieldJs,
  cleanupTmpDirSync,
} = require('@hubspot/cli-lib/lib/handleFieldsJs');

exports.command = 'upload [--src] [--dest]';
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
  const src = options.src || uploadPromptAnswers.src;
  const saveOutput = options.saveOutput;
  let dest = options.dest || uploadPromptAnswers.dest;
  let absoluteSrcPath = path.resolve(getCwd(), src);
  if (!dest) {
    logger.error(i18n(`${i18nKey}.errors.destinationRequired`));
    return;
  }
  // Check for theme.json file and determine the root path for the project based on it if it exists
  const themeJsonPath = getThemeJSONPath(absoluteSrcPath);
  const projectRoot = themeJsonPath
    ? path.dirname(themeJsonPath)
    : path.dirname(getCwd());
  const convertFields =
    projectRoot &&
    isConvertableFieldJs(projectRoot, absoluteSrcPath, options.convertFields);
  let fieldsJs;
  if (convertFields) {
    fieldsJs = await new FieldsJs(
      projectRoot,
      absoluteSrcPath,
      undefined,
      options.fieldOptions
    ).init();
    if (fieldsJs.rejected) return;
    // Ensures that the dest path is a .json. The user might pass '.js' accidentally - this ensures it just works.
    absoluteSrcPath = fieldsJs.outputPath;
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
    if (!isAllowedExtension(src) && !convertFields) {
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
      absoluteSrcPath,
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
        if (!convertFields) return;
        if (saveOutput) {
          fieldsJs.saveOutput();
        }
        cleanupTmpDirSync(fieldsJs.rootWriteDir);
      });
  } else {
    logger.log(
      i18n(`${i18nKey}.uploading`, {
        accountId,
        dest,
        src,
      })
    );

    // Generate the first-pass file list in here, and pass to uploadFolder.
    const filePaths = await getUploadableFileList(
      absoluteSrcPath,
      options.convertFields
    );

    if (options.clean) {
      //  If clean is true, will first delete the dest folder and then upload src. Cleans up files that only exist on HS.
      let cleanUpload = options.force;
      if (!options.force) {
        cleanUpload = await cleanUploadPrompt(accountId, dest);
      }
      if (cleanUpload) {
        try {
          await deleteFile(accountId, dest);
          logger.log(
            i18n(`${i18nKey}.cleaning`, { accountId, filePath: dest })
          );
        } catch (error) {
          logger.error(
            i18n(`${i18nKey}.errors.deleteFailed`, {
              accountId,
              path: dest,
            })
          );
        }
      }
    }
    uploadFolder(
      accountId,
      absoluteSrcPath,
      dest,
      {
        mode,
      },
      options,
      filePaths
    )
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
  yargs.option('fieldOptions', {
    describe: i18n(`${i18nKey}.options.options.describe`),
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('saveOutput', {
    describe: i18n(`${i18nKey}.options.saveOutput.describe`),
    type: 'boolean',
    default: false,
  });
  yargs.option('convertFields', {
    describe: i18n(`${i18nKey}.options.convertFields.describe`),
    type: 'boolean',
    default: false,
  });
  yargs.option('clean', {
    describe: i18n(`${i18nKey}.options.clean.describe`),
    type: 'boolean',
    default: false,
  });
  yargs.option('force', {
    describe: i18n(`${i18nKey}.options.force.describe`),
    type: 'boolean',
    default: false,
  });
  return yargs;
};
