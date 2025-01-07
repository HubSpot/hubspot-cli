// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { clearHubDbTableRows } = require('@hubspot/local-dev-lib/hubdb');
const { publishTable } = require('@hubspot/local-dev-lib/api/hubdb');
const {
  selectHubDBTablePrompt,
} = require('../../lib/prompts/selectHubDBTablePrompt');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.clear';

exports.command = 'clear [table-id]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { derivedAccountId } = options;

  trackCommandUsage('hubdb-clear', null, derivedAccountId);

  try {
    const { tableId } =
      'tableId' in options
        ? options
        : await selectHubDBTablePrompt({
            accountId: derivedAccountId,
            options,
          });

    const { deletedRowCount } = await clearHubDbTableRows(
      derivedAccountId,
      tableId
    );
    if (deletedRowCount > 0) {
      logger.log(
        i18n(`${i18nKey}.logs.removedRows`, {
          deletedRowCount,
          tableId,
        })
      );
      const {
        data: { rowCount },
      } = await publishTable(derivedAccountId, tableId);
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
    logError(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('table-id', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });
};
