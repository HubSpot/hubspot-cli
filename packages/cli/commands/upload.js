const fs = require('fs');
const path = require('path');
const { uploadFolder, hasUploadErrors } = require('@hubspot/cli-lib');
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
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { uploadPrompt } = require('../lib/prompts/uploadPrompt');
const { deleteFilePrompt } = require('../lib/prompts/deleteFilePrompt');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getUploadableFileList, getDeletedFilesList } = require('../lib/upload');
const {
  getThemePreviewUrl,
  getThemeJSONPath,
} = require('@hubspot/cli-lib/lib/files');
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

const isRootUpload = (projectRoot, absoluteSrcPath, normalizedDest) => {
  // Only allow removal if it is a root -> root upload.
  const srcIsRoot = projectRoot === absoluteSrcPath;
  // The normalized path contains no '/' only if it is a root, since convertToUnix strips leading and trailing '/'.
  const destIsRoot = !normalizedDest.includes('/');

  return srcIsRoot && destIsRoot;
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

    if (options.remove) {
      if (!isRootUpload(projectRoot, absoluteSrcPath, normalizedDest)) {
        // Can't remove. Error and exit.
        logger.error(
          'Source or Dest do not point to the root. Cannot do --remove unless you are uploading full projects'
        );
      }
      const remoteAndNotLocal = await getDeletedFilesList(
        accountId,
        projectRoot,
        normalizedDest,
        filePaths
      );
      for (const filePath of remoteAndNotLocal) {
        const hsPath = path.join(normalizedDest, filePath);
        let deleteFile = options.force;
        if (!options.force) {
          deleteFile = await deleteFilePrompt(hsPath);
        }
        if (deleteFile) {
          try {
            //await deleteFile(accountId, hsPath);
            logger.log(i18n(`${i18nKey}.deleted`, { accountId, path: hsPath }));
          } catch (error) {
            logger.error(
              i18n(`${i18nKey}.errors.deleteFailed`, {
                accountId,
                path: hsPath,
              })
            );
          }
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
  yargs.option('remove', {
    //describe: i18n(`${i18nKey}.options.remove.describe`),
    type: 'boolean',
    default: false,
    alias: ['r'],
  });
  yargs.option('force', {
    //describe: i18n(`${i18nKey}.options.forceRemove.describe`),
    type: 'boolean',
    default: false,
    alias: ['f'],
  });
  return yargs;
};
