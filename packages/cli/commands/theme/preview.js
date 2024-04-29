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
const {
  previewPrompt,
  previewProjectPrompt,
} = require('../../lib/prompts/previewPrompt');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  FILE_UPLOAD_RESULT_TYPES,
} = require('@hubspot/local-dev-lib/constants/files');
const cliProgress = require('cli-progress');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('../../lib/errorHandlers/apiErrors');
const { handleExit, handleKeypress } = require('../../lib/process');
const { getThemeJSONPath } = require('@hubspot/local-dev-lib/cms/themes');
const { getProjectConfig } = require('../../lib/projects');
const {
  findProjectComponents,
  COMPONENT_TYPES,
} = require('../../lib/projectStructure');

const i18nKey = 'cli.commands.preview';
exports.command = 'preview [--src] [--dest]';
exports.describe = i18n(`${i18nKey}.describe`);

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

const determineSrcAndDest = async options => {
  let absoluteSrc;
  let dest;
  const { projectDir, projectConfig } = await getProjectConfig();
  if (!(projectDir && projectConfig)) {
    // Not in a project, prompt for src and dest of traditional theme
    const previewPromptAnswers = await previewPrompt(options);
    const src = options.src || previewPromptAnswers.src;
    dest = options.dest || previewPromptAnswers.dest;
    absoluteSrc = path.resolve(getCwd(), src);
    if (!dest || !validateSrcPath(absoluteSrc)) {
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    // In a project
    let themeJsonPath = getThemeJSONPath();
    if (!themeJsonPath) {
      const projectComponents = await findProjectComponents(projectDir);
      const themeComponents = projectComponents.filter(
        c => c.type === COMPONENT_TYPES.hublTheme
      );
      if (themeComponents.length === 0) {
        logger.error(i18n(`${i18nKey}.errors.noThemeComponents`));
        process.exit(EXIT_CODES.ERROR);
      }
      const answer = await previewProjectPrompt(themeComponents);
      themeJsonPath = `${answer.themeComponentPath}/theme.json`;
    }
    const { dir: themeDir } = path.parse(themeJsonPath);
    absoluteSrc = themeDir;
    const { base: themeName } = path.parse(themeDir);
    dest = `@projects/${projectConfig.name}/${themeName}`;
  }
  return { absoluteSrc, dest };
};

exports.handler = async options => {
  const { notify, skipUpload, noSsl, port, debug } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const { absoluteSrc, dest } = await determineSrcAndDest(options);

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
        if (result.resultType == FILE_UPLOAD_RESULT_TYPES.FAILURE) {
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
