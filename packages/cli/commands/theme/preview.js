const fs = require('fs');
const path = require('path');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { getCwd } = require('@hubspot/cli-lib/path');
const { preview } = require('@hubspot/cli-lib/lib/preview');
const { getUploadableFileList } = require('../../lib/upload');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { previewPrompt } = require('../../lib/prompts/previewPrompt');

const i18nKey = 'cli.commands.preview';

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
      return;
    }
  } catch (e) {
    logInvalidPath();
    return;
  }
  return;
};

exports.command = 'preview';
exports.describe = false;

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
  validateSrcPath(absoluteSrc);

  const filePaths = await getUploadableFileList(absoluteSrc, false);
  trackCommandUsage('preview', accountId);

  preview(accountId, absoluteSrc, dest, {
    notify,
    filePaths,
    skipUpload,
    noSsl,
    port,
    debug,
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
