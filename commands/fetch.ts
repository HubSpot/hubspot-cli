// @ts-nocheck
const { downloadFileOrFolder } = require('@hubspot/local-dev-lib/fileMapper');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addCmsPublishModeOptions,
  addUseEnvironmentOptions,
  getAccountId,
  getCmsPublishMode,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const {
  validateCmsPublishMode,
  loadAndValidateOptions,
} = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.fetch';
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { logError } = require('../lib/errorHandlers/index');

exports.command = 'fetch <src> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest } = options;

  await loadAndValidateOptions(options);

  if (!validateCmsPublishMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    logger.error(i18n(`${i18nKey}.errors.sourceRequired`));
    process.exit(EXIT_CODES.ERROR);
  }

  const accountId = getAccountId(options);
  const cmsPublishMode = getCmsPublishMode(options);

  trackCommandUsage('fetch', { mode: cmsPublishMode }, accountId);

  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      accountId,
      src,
      resolveLocalPath(dest),
      cmsPublishMode,
      options
    );
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addOverwriteOptions(yargs);
  addCmsPublishModeOptions(yargs, { read: true });
  addUseEnvironmentOptions(yargs);

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
