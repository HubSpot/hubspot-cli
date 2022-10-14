const fs = require('fs');
const path = require('path');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { createIgnoreFilter } = require('@hubspot/cli-lib/ignoreRules');
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
const { fieldsJsPrompt } = require('../lib/prompts/cmsFieldPrompt');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const {
  getThemePreviewUrl,
  getThemeJSONPath,
} = require('@hubspot/cli-lib/lib/files');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const i18nKey = 'cli.commands.upload';
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const {
  FieldsJs,
  isProcessableFieldsJs,
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
  // The theme.json file must always be at the root of the project - so we look for that and determine the root path based on it.
  const themeJsonPath = getThemeJSONPath(absoluteSrcPath);
  const projectRoot = themeJsonPath && path.dirname(themeJsonPath);
  const processFieldsJs =
    projectRoot &&
    isProcessableFieldsJs(
      projectRoot,
      absoluteSrcPath,
      options.processFieldsJs
    );
  let fieldsJs;
  if (processFieldsJs) {
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
    if (!isAllowedExtension(src) && !processFieldsJs) {
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
        if (!processFieldsJs) return;
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
      options.processFieldsJs
    );
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

/*
 * Walks the src folder for files, filters them based on ignore filter.
 * If processFieldsJs is true then will check for any JS fields conflicts (i.e., JS fields file and fields.json file) and prompt to resolve
 */
const getUploadableFileList = async (src, processFieldsJs) => {
  const filePaths = await walk(src);
  const allowedFiles = filePaths
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter());
  if (!processFieldsJs) {
    return allowedFiles;
  }

  let uploadableFiles = [];
  let skipFiles = [];
  for (const filePath of allowedFiles) {
    const fileName = path.basename(filePath);
    if (skipFiles.includes(filePath)) continue;
    const isProcessable = isProcessableFieldsJs(src, filePath, processFieldsJs);
    if (isProcessable || fileName == 'fields.json') {
      // This prompt checks if there are multiple field files in the folder and gets user to choose.
      const [choice, updatedSkipFiles] = await fieldsJsPrompt(
        filePath,
        src,
        skipFiles
      );
      skipFiles = updatedSkipFiles;
      // If they chose something other than the current file, move on.
      if (choice !== filePath) continue;
    }
    uploadableFiles.push(filePath);
  }
  return uploadableFiles;
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
    hidden: true,
  });
  yargs.option('processFieldsJs', {
    describe: i18n(`${i18nKey}.options.processFields.describe`),
    alias: ['processFields'],
    type: 'boolean',
    default: false,
    hidden: true,
  });
  return yargs;
};
