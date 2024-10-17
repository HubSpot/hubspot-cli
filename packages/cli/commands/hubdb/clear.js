const { logger } = require('@hubspot/local-dev-lib/logger');
const { logApiErrorInstance } = require('../../lib/errorHandlers/apiErrors');
const { clearHubDbTableRows } = require('@hubspot/local-dev-lib/hubdb');
const { publishTable } = require('@hubspot/local-dev-lib/api/hubdb');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.clear';

exports.command = 'clear <tableId>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { tableId, account } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-clear', null, account);

  try {
    const { deletedRowCount } = await clearHubDbTableRows(account, tableId);
    if (deletedRowCount > 0) {
      logger.log(
        i18n(`${i18nKey}.logs.removedRows`, {
          deletedRowCount,
          tableId,
        })
      );
      const { rowCount } = await publishTable(account, tableId);
      logger.log(
        i18n(`${i18nKey}.logs.rowCount`, {
          rowCount,
          tableId,
        })
      );
    } else {
      logger.log(
        i18n(`${i18nKey}.logs.emptyTable`, {
          tableId,
        })
      );
    }
  } catch (e) {
    logApiErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('tableId', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });
};
