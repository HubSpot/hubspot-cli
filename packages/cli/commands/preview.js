const fs = require('fs');
const path = require('path');
const { i18n } = require('../lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountId } = require('../lib/commonOpts');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { getCwd } = require('@hubspot/cli-lib/path');
const { preview } = require('@hubspot/cli-lib/lib/preview');
const { getUploadableFileList } = require('../lib/upload');
const { trackCommandUsage } = require('../lib/usageTracking');

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
      return false;
    }
  } catch (e) {
    logInvalidPath();
    return false;
  }
  return true;
};

exports.command = 'preview <src> <dest>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest, notify, skipUpload, noSsl, port } = options;

  const accountId = getAccountId(options);
  const absoluteSrc = path.resolve(getCwd(), src);

  if (!validateSrcPath(absoluteSrc)) {
    process.exit(EXIT_CODES.ERROR);
  }

  const filePaths = await getUploadableFileList(absoluteSrc, false);
  trackCommandUsage('preview', accountId);
  preview(accountId, absoluteSrc, dest, {
    notify,
    filePaths,
    skipUpload,
    noSsl,
    port,
  });
};

exports.builder = yargs => {
  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('skipUpload', {
    alias: 'skip',
    describe: i18n(`${i18nKey}.options.skipUpload.describe`),
    type: 'boolean',
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
  return yargs;
};
