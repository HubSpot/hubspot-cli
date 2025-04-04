// @ts-nocheck
const fs = require('fs');
const path = require('path');

const { watch } = require('@hubspot/local-dev-lib/cms/watch');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addCmsPublishModeOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
  getCmsPublishMode,
} = require('../lib/commonOpts');
const { uploadPrompt } = require('../lib/prompts/uploadPrompt');
const { validateCmsPublishMode } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');
const { getUploadableFileList } = require('../lib/upload');
const { logError, ApiErrorContext } = require('../lib/errorHandlers/index');

const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'watch [src] [dest]';
exports.describe = i18n(`commands.watch.describe`);

exports.handler = async options => {
  const { remove, initialUpload, disableInitial, notify, derivedAccountId } =
    options;

  if (!validateCmsPublishMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  const cmsPublishMode = getCmsPublishMode(options);

  const uploadPromptAnswers = await uploadPrompt(options);

  const src = options.src || uploadPromptAnswers.src;
  const dest = options.dest || uploadPromptAnswers.dest;

  const absoluteSrcPath = path.resolve(getCwd(), src);
  try {
    const stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      logger.log(
        i18n(`commands.watch.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.log(
      i18n(`commands.watch.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!dest) {
    logger.log(i18n(`commands.watch.errors.destinationRequired`));
    return;
  }

  let filesToUpload = [];

  if (disableInitial) {
    logger.info(i18n(`commands.watch.warnings.disableInitial`));
  } else if (!initialUpload) {
    logger.info(i18n(`commands.watch.warnings.notUploaded`, { path: src }));
    logger.info(i18n(`commands.watch.warnings.initialUpload`));
  }

  if (initialUpload) {
    filesToUpload = await getUploadableFileList(
      absoluteSrcPath,
      options.convertFields
    );
  }

  trackCommandUsage('watch', { mode: cmsPublishMode }, derivedAccountId);

  const postInitialUploadCallback = null;
  const onUploadFolderError = error => {
    logger.error(
      i18n(`commands.watch.errors.folderFailed`, {
        src,
        dest,
        accountId: derivedAccountId,
      })
    );
    logError(error, {
      accountId: derivedAccountId,
    });
  };
  const onQueueAddError = null;
  const onUploadFileError = (file, dest, derivedAccountId) => error => {
    logger.error(
      i18n(`commands.watch.errors.fileFailed`, {
        file,
        dest,
        accountId: derivedAccountId,
      })
    );
    logError(
      error,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: dest,
        payload: file,
      })
    );
  };
  watch(
    derivedAccountId,
    absoluteSrcPath,
    dest,
    {
      cmsPublishMode,
      remove,
      disableInitial: initialUpload ? false : true,
      notify,
      commandOptions: options,
      filePaths: filesToUpload,
    },
    postInitialUploadCallback,
    onUploadFolderError,
    onQueueAddError,
    onUploadFileError
  );
};

exports.builder = yargs => {
  yargs.positional('src', {
    describe: i18n(`commands.watch.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`commands.watch.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: i18n(`commands.watch.options.options.describe`),
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('remove', {
    alias: 'r',
    describe: i18n(`commands.watch.options.remove.describe`),
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: i18n(`commands.watch.options.initialUpload.describe`),
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    describe: i18n(`commands.watch.options.disableInitial.describe`),
    type: 'boolean',
    hidden: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe: i18n(`commands.watch.options.notify.describe`),
    type: 'string',
    requiresArg: true,
  });
  yargs.option('convertFields', {
    describe: i18n(`commands.watch.options.convertFields.describe`),
    type: 'boolean',
    default: false,
  });
  yargs.option('saveOutput', {
    describe: i18n(`commands.watch.options.saveOutput.describe`),
    type: 'boolean',
    default: false,
  });

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addCmsPublishModeOptions(yargs, { write: true });
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};
