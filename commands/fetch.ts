// @ts-nocheck
const { downloadFileOrFolder } = require('@hubspot/local-dev-lib/fileMapper');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addCmsPublishModeOptions,
  addUseEnvironmentOptions,
  getCmsPublishMode,
  addGlobalOptions,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { validateCmsPublishMode } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { logError } = require('../lib/errorHandlers/index');

exports.command = 'fetch <src> [dest]';
exports.describe = i18n('commands.fetch.describe');

exports.handler = async options => {
  const { src, dest } = options;

  if (!validateCmsPublishMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    logger.error(i18n('commands.fetch.errors.sourceRequired'));
    process.exit(EXIT_CODES.ERROR);
  }

  const { derivedAccountId } = options;
  const cmsPublishMode = getCmsPublishMode(options);

  trackCommandUsage('fetch', { mode: cmsPublishMode }, derivedAccountId);

  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      derivedAccountId,
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
  yargs.positional('src', {
    describe: i18n('commands.fetch.positionals.src.describe'),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n('commands.fetch.positionals.dest.describe'),
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: i18n('commands.fetch.options.staging.describe'),
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.options({
    assetVersion: {
      type: 'number',
      describe: i18n('commands.fetch.options.assetVersion.describe'),
    },
  });

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addOverwriteOptions(yargs);
  addCmsPublishModeOptions(yargs, { read: true });
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};
