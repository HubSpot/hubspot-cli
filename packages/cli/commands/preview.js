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

exports.command = 'preview <src> <dest>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest, notify, skipInitial } = options;

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
    skipInitial,
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
  yargs.option('skipInitial', {
    alias: 'skip',
    describe: i18n(`${i18nKey}.options.skipInitial.describe`),
    type: 'boolean',
  });
  return yargs;
};

const validateSrcPath = src => {
  const logInvalidPath = () => {
    logger.log(
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
