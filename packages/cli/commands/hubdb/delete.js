const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { deleteTable } = require('@hubspot/cli-lib/api/hubdb');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.hubdb.subcommands.delete';

exports.command = 'delete <tableId>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { tableId } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-delete', null, accountId);

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
