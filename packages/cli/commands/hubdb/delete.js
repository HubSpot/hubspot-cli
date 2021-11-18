const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { deleteTable } = require('@hubspot/cli-lib/api/hubdb');
const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.hubdb.subcommands.delete';

exports.command = 'delete <tableId>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { config: configPath, tableId } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-delete', {}, accountId);

  try {
    await deleteTable(accountId, tableId);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountId,
        tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        tableId,
      })
    );
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('tableId', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });
};
