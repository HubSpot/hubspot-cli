const { downloadFileOrFolder } = require('@hubspot/cli-lib/fileMapper');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.fetch';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'fetch <src> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest } = options;

  await loadAndValidateOptions(options);

  if (!validateMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    logger.error(i18n(`${i18nKey}.errors.sourceRequired`));
    process.exit(EXIT_CODES.ERROR);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);

  trackCommandUsage('fetch', { mode }, accountId);

  // Fetch and write file/folder.
  downloadFileOrFolder({
    accountId,
    src,
    dest: resolveLocalPath(dest),
    mode,
    options,
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addOverwriteOptions(yargs, true);
  addModeOptions(yargs, { read: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: i18n(`${i18nKey}.options.staging.describe`),
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.options({
    assetVersion: {
      type: 'number',
      describe: i18n(`${i18nKey}.options.assetVersion.describe`),
    },
  });

  return yargs;
};
