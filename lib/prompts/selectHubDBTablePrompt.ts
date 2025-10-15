import fs from 'fs';
import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
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
      uiLogger.log(
        lib.prompts.selectHubDBTablePrompt.errors.noTables(accountId.toString())
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
    return tables;
  } catch (error) {
    debugError(error, { accountId });
    uiLogger.error(
      lib.prompts.selectHubDBTablePrompt.errors.errorFetchingTables(
        accountId.toString()
      )
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
      message: lib.prompts.selectHubDBTablePrompt.selectTable,
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
      message: lib.prompts.selectHubDBTablePrompt.enterDest,
      when: !options.dest && !skipDestPrompt,
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.selectHubDBTablePrompt.errors.destRequired;
        }
        if (fs.existsSync(input)) {
          return lib.prompts.selectHubDBTablePrompt.errors.invalidDest;
        }
        if (!isValidPath(input)) {
          return lib.prompts.selectHubDBTablePrompt.errors.invalidCharacters;
        }
        return true;
      },
      filter: (input: string) => {
        return untildify(input);
      },
    },
  ]);
}
