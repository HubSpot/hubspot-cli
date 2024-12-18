// @ts-nocheck
const { downloadFileOrFolder } = require('@hubspot/local-dev-lib/fileManager');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { resolveLocalPath } = require('../../lib/filesystem');
const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addGlobalOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.filemanager.subcommands.fetch';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { logError } = require('../../lib/errorHandlers/index');

exports.command = 'fetch <src> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, includeArchived, derivedAccountId, overwrite } = options;

  if (typeof src !== 'string') {
    logger.error(i18n(`${i18nKey}.errors.sourceRequired`));
    process.exit(EXIT_CODES.ERROR);
  }

  const dest = resolveLocalPath(options.dest);

  trackCommandUsage('filemanager-fetch', null, derivedAccountId);

  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      derivedAccountId,
      src,
      dest,
      overwrite,
      includeArchived || false
    );
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  addGlobalOptions(yargs);
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addOverwriteOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('include-archived', {
    alias: ['i'],
    describe: i18n(`${i18nKey}.options.includeArchived.describe`),
    type: 'boolean',
  });
};
