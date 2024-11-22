import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { logError } from '../errorHandlers/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';
import { EXIT_CODES } from '../enums/exitCodes';
import { Table } from '@hubspot/local-dev-lib/types/Hubdb';

const i18nKey = 'lib.prompts.selectHubDBTablePrompt';

async function fetchHubDBOptions(accountId: number) {
  try {
    const {
      data: { results: tables },
    } = await fetchTables(accountId);
    if (tables.length === 0) {
      logger.log(i18n(`${i18nKey}.errors.noTables`, { accountId }));
      return;
    }
    if (tables.every(table => table.rowCount === 0)) {
      logger.error(i18n(`${i18nKey}.errors.allTablesEmpty`, { accountId }));
      process.exit(EXIT_CODES.ERROR);
    }
    return tables;
  } catch (error) {
    logError(error, { accountId });
    logger.error(i18n(`${i18nKey}.errors.errorFetchingTables`, { accountId }));
    process.exit(EXIT_CODES.ERROR);
  }
}

export async function selectHubDBTablePrompt({
  accountId,
  options,
}: {
  accountId: number;
  options: {
    tableId?: number;
  };
  skipDestPrompt?: boolean;
}) {
  const { tableId } = options;
  const hubdbTables: Table[] = (await fetchHubDBOptions(accountId)) || [];
  const selectedTable =
    tableId && hubdbTables.find(table => table.id === tableId.toString());

  return promptUser([
    {
      name: 'tableId',
      message: i18n(`${i18nKey}.selectTable`),
      when: !selectedTable,
      type: 'list',
      choices: hubdbTables.map(table => {
        if (table.rowCount === 0) {
          return {
            name: `${table.label} (${table.id})`,
            disabled: i18n(`${i18nKey}.errors.tableEmpty`),
          };
        }
        return {
          name: `${table.label} (${table.id})`,
          value: table.id,
        };
      }),
    },
  ]);
}
