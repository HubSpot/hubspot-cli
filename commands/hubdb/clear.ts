// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { clearHubDbTableRows } = require('@hubspot/local-dev-lib/hubdb');
const {
  fetchTables,
  publishTable,
} = require('@hubspot/local-dev-lib/api/hubdb');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { addUseEnvironmentOptions } = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.clear';

exports.command = 'clear [table-id]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { 'table-id': tableId, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-clear', null, derivedAccountId);

  let promptedTableId;
  try {
    if (!tableId) {
      const {
        data: { results: tables },
      } = await fetchTables(derivedAccountId);
      if (tables.length === 0) {
        logger.log(
          i18n(`${i18nKey}.errors.noTables`, { accountId: derivedAccountId })
        );
        return;
      }

      const promptAnswer = await promptUser([
        {
          name: 'promptedTableId',
          message: i18n(`${i18nKey}.prompt.selectTable`),
          type: 'list',
          choices: tables.map(table => {
            return {
              name: `${table.label} (${table.id})`,
              value: table.id,
            };
          }),
        },
      ]);
      promptedTableId = promptAnswer.promptedTableId;
    }
  } catch (e) {
    logger.log(
      i18n(`${i18nKey}.errors.unableToFetchTables`, {
        accountId: derivedAccountId,
      })
    );
    logError(e);
  }

  try {
    const tableToClear = tableId || promptedTableId;
    const { deletedRowCount } = await clearHubDbTableRows(
      derivedAccountId,
      tableToClear
    );
    if (deletedRowCount > 0) {
      logger.log(
        i18n(`${i18nKey}.logs.removedRows`, {
          deletedRowCount,
          tableToClear,
        })
      );
      const {
        data: { rowCount },
      } = await publishTable(derivedAccountId, tableToClear);
      logger.log(
        i18n(`${i18nKey}.logs.rowCount`, {
          rowCount,
          tableToClear,
        })
      );
    } else {
      logger.log(
        i18n(`${i18nKey}.logs.emptyTable`, {
          tableToClear,
        })
      );
    }
  } catch (e) {
    logError(e);
  }
};

exports.builder = yargs => {
  addUseEnvironmentOptions(yargs);

  yargs.positional('table-id', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });
};
