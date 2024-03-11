const fs = require('fs');
const path = require('path');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { preview } = require('@hubspot/theme-preview-dev-server');
const { getUploadableFileList } = require('../../lib/upload');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { previewPrompt } = require('../../lib/prompts/previewPrompt');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { FileUploadResultType } = require('@hubspot/cli-lib/lib/uploadFolder');
const i18nKey = 'cli.commands.preview';
const cliProgress = require('cli-progress');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('../../lib/errorHandlers/apiErrors');
const { handleExit, handleKeypress } = require('../../lib/process');

exports.command = 'preview [--src] [--dest]';
exports.describe = false; // i18n(`${i18nKey}.describe`) - Hiding command

const validateSrcPath = src => {
  const logInvalidPath = () => {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: src,
      })
    );
  };
  try {
    const stats = fs.statSync(src);
    if (!stats.isDirectory()) {
      logInvalidPath();
      return false;
    }
  } catch (e) {
    logInvalidPath();
    return false;
  }
  return true;
};

const handleUserInput = () => {
  const onTerminate = () => {
    logger.log(i18n(`${i18nKey}.logs.processExited`));
    process.exit(EXIT_CODES.SUCCESS);
  };

  handleExit(onTerminate);
  handleKeypress(key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      onTerminate();
    }
  });
};

exports.handler = async options => {
  const { notify, skipUpload, noSsl, port, debug } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const previewPromptAnswers = await previewPrompt(options);
  const src = options.src || previewPromptAnswers.src;
  let dest = options.dest || previewPromptAnswers.dest;
  if (!dest) {
    logger.error(i18n(`${i18nKey}.errors.destinationRequired`));
    return;
  }

  const absoluteSrc = path.resolve(getCwd(), src);
  if (!validateSrcPath(absoluteSrc)) {
    process.exit(EXIT_CODES.ERROR);
  }

  const filePaths = await getUploadableFileList(absoluteSrc, false);

  const initialUploadProgressBar = new cliProgress.SingleBar(
    {
      gracefulExit: true,
      format: '[{bar}] {percentage}% | {value}/{total} | {label}',
      hideCursor: true,
    },
    cliProgress.Presets.rect
  );
  initialUploadProgressBar.start(filePaths.length, 0, {
    label: i18n(`${i18nKey}.initialUploadProgressBar.start`),
  });
  let uploadsHaveStarted = false;
  const uploadOptions = {
    onAttemptCallback: () => {
      /* Intentionally blank */
    },
    onSuccessCallback: () => {
      initialUploadProgressBar.increment();
      if (!uploadsHaveStarted) {
        uploadsHaveStarted = true;
        initialUploadProgressBar.update(0, {
          label: i18n(`${i18nKey}.initialUploadProgressBar.uploading`),
        });
      }
    },
    onFirstErrorCallback: () => {
      /* Intentionally blank */
    },
    onRetryCallback: () => {
      /* Intentionally blank */
    },
    onFinalErrorCallback: () => initialUploadProgressBar.increment(),
    onFinishCallback: results => {
      initialUploadProgressBar.update(filePaths.length, {
        label: i18n(`${i18nKey}.initialUploadProgressBar.finish`),
      });
      initialUploadProgressBar.stop();
      results.forEach(result => {
        if (result.resultType == FileUploadResultType.FAILURE) {
          logger.error('Uploading file "%s" to "%s" failed', result.file, dest);
          logApiUploadErrorInstance(
            result.error,
            new ApiErrorContext({
              accountId,
              request: dest,
              payload: result.file,
            })
          );
        }
      });
    },
  };

  trackCommandUsage('preview', accountId);

  preview(accountId, absoluteSrc, dest, {
    notify,
    filePaths,
    skipUpload,
    noSsl,
    port,
    debug,
    uploadOptions,
    handleUserInput,
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.option('src', {
    describe: i18n(`${i18nKey}.options.src.describe`),
    type: 'string',
    requiresArg: true,
  });
  yargs.option('dest', {
    describe: i18n(`${i18nKey}.options.dest.describe`),
    type: 'string',
    requiresArg: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe: i18n(`${i18nKey}.options.notify.describe`),
    type: 'string',
    requiresArg: true,
  });
  yargs.option('no-ssl', {
    describe: i18n(`${i18nKey}.options.noSsl.describe`),
    type: 'boolean',
  });
  yargs.option('port', {
    describe: i18n(`${i18nKey}.options.port.describe`),
    type: 'number',
  });
  yargs.option('debug', {
    describe: false,
    type: 'boolean',
  });
  yargs.option('skipUpload', {
    alias: 'skip',
    describe: false,
    type: 'boolean',
  });
  return yargs;
};
