const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { downloadFileOrFolder } = require('@hubspot/cli-lib/fileManager');
const { logger } = require('@hubspot/cli-lib/logger');
const { resolveLocalPath } = require('../../lib/filesystem');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.filemanager.subcommands.fetch';

exports.command = 'fetch <src> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let { config: configPath, src, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!validateConfig() || !(await validateAccount(options))) {
    process.exit(1);
  }

  if (typeof src !== 'string') {
    logger.error(i18n(`${i18nKey}.errors.sourceRequired`));
    process.exit(1);
  }

  dest = resolveLocalPath(dest);

  const accountId = getAccountId(options);

  trackCommandUsage('filemanager-fetch', {}, accountId);

  // Fetch and write file/folder.
  downloadFileOrFolder(accountId, src, dest, options);
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
