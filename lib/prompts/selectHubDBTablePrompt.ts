import fs from 'fs';
import { promptUser } from './promptUtils.js';
import { i18n } from '../lang.js';
import { debugError } from '../errorHandlers/index.js';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { Table } from '@hubspot/local-dev-lib/types/Hubdb';
import { isValidPath, untildify } from '@hubspot/local-dev-lib/path';

async function fetchHubDBOptions(accountId: number) {
  try {
    const {
      data: { results: tables },
    } = await fetchTables(accountId);
    if (tables.length === 0) {
      logger.log(
        i18n(`lib.prompts.selectHubDBTablePrompt.errors.noTables`, {
          accountId,
        })
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
    return tables;
  } catch (error) {
    debugError(error, { accountId });
    logger.error(
      i18n(`lib.prompts.selectHubDBTablePrompt.errors.errorFetchingTables`, {
        accountId,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }
}

export async function selectHubDBTablePrompt({
  accountId,
  options,
  skipDestPrompt = true,
}: {
  accountId: number;
  options: {
    tableId?: number;
    dest?: string;
  };
  skipDestPrompt?: boolean;
}) {
  const hubdbTables: Table[] = (await fetchHubDBOptions(accountId)) || [];
  const id = options.tableId?.toString();
  const isValidTable =
    options.tableId && hubdbTables.find(table => table.id === id);

  return promptUser([
    {
      name: 'tableId',
      message: i18n(`lib.prompts.selectHubDBTablePrompt.selectTable`),
      when: !id && !isValidTable,
      type: 'list',
      choices: hubdbTables.map(table => {
        return {
          name: `${table.label} (${table.id})`,
          value: table.id,
        };
      }),
    },
    {
      name: 'dest',
      message: i18n(`lib.prompts.selectHubDBTablePrompt.enterDest`),
      when: !options.dest && !skipDestPrompt,
      validate: (input?: string) => {
        if (!input) {
          return i18n(`lib.prompts.selectHubDBTablePrompt.errors.destRequired`);
        }
        if (fs.existsSync(input)) {
          return i18n(`lib.prompts.selectHubDBTablePrompt.errors.invalidDest`);
        }
        if (!isValidPath(input)) {
          return i18n(
            `lib.prompts.selectHubDBTablePrompt.errors.invalidCharacters`
          );
        }
        return true;
      },
      filter: (input: string) => {
        return untildify(input);
      },
    },
  ]);
}
