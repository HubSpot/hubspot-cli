import fs from 'fs';
import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';
import { Table } from '@hubspot/local-dev-lib/types/Hubdb';
import { isValidPath, untildify } from '@hubspot/local-dev-lib/path';
import {
  isPromptExitError,
  PromptExitError,
} from '../errors/PromptExitError.js';
import { EXIT_CODES } from '../enums/exitCodes.js';

async function fetchHubDBOptions(accountId: number): Promise<Table[]> {
  try {
    const {
      data: { results: tables },
    } = await fetchTables(accountId);
    if (tables.length === 0) {
      uiLogger.log(
        lib.prompts.selectHubDBTablePrompt.errors.noTables(accountId.toString())
      );
      throw new PromptExitError(
        lib.prompts.selectHubDBTablePrompt.errors.noTables(
          accountId.toString()
        ),
        EXIT_CODES.SUCCESS
      );
    }
    return tables;
  } catch (error) {
    if (isPromptExitError(error)) {
      throw error;
    }
    debugError(error, { accountId });
    uiLogger.error(
      lib.prompts.selectHubDBTablePrompt.errors.errorFetchingTables(
        accountId.toString()
      )
    );
    throw new PromptExitError(
      lib.prompts.selectHubDBTablePrompt.errors.errorFetchingTables(
        accountId.toString()
      ),
      EXIT_CODES.ERROR
    );
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
  const hubdbTables: Table[] = await fetchHubDBOptions(accountId);
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
