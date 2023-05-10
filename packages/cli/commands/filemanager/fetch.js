const { downloadFileOrFolder } = require('@hubspot/cli-lib/fileManager');
const { logger } = require('@hubspot/cli-lib/logger');
const { resolveLocalPath } = require('../../lib/filesystem');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.filemanager.subcommands.fetch';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'fetch <src> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let { src, dest } = options;

  await loadAndValidateOptions(options);

  if (typeof src !== 'string') {
    logger.error(i18n(`${i18nKey}.errors.sourceRequired`));
    process.exit(EXIT_CODES.ERROR);
  }

  dest = resolveLocalPath(dest);

  const accountId = getAccountId(options);

  trackCommandUsage('filemanager-fetch', null, accountId);

  // Fetch and write file/folder.
  await downloadFileOrFolder(accountId, src, dest, options);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

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
