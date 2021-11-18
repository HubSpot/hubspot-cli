const path = require('path');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { getCwd } = require('@hubspot/cli-lib/path');
const { createHubDbTable } = require('@hubspot/cli-lib/hubdb');

const { validateAccount, isFileValidJSON } = require('../../lib/validation');
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

const i18nKey = 'cli.commands.hubdb.subcommands.create';

exports.command = 'create <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { config: configPath, src } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-create', {}, accountId);

  try {
    const filePath = path.resolve(getCwd(), src);
    if (!isFileValidJSON(filePath)) {
      process.exit(1);
    }

    const table = await createHubDbTable(
      accountId,
      path.resolve(getCwd(), src)
    );
    logger.success(
      i18n(`${i18nKey}.success.create`, {
        accountId,
        rowCount: table.rowCount,
        tableId: table.tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.create`, {
        src,
      })
    );
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
};
