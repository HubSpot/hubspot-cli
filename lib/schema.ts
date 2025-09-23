import chalk from 'chalk';
import { table, getBorderCharacters } from 'table';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { Schema } from '@hubspot/local-dev-lib/types/Schemas';
import { uiLogger } from './ui/logger.js';

export function logSchemas(schemas: Array<Schema>): void {
  const data = schemas
    .map(r => [r.labels.singular, r.name, r.objectTypeId || ''])
    .sort((a, b) => (a[1] > b[1] ? 1 : -1));

  if (data.length === 0) {
    uiLogger.log('No Schemas were found');
    return;
  }

  data.unshift([
    chalk.bold('Label'),
    chalk.bold('Name'),
    chalk.bold('objectTypeId'),
  ]);

  const tableConfig = {
    singleLine: true,
    border: getBorderCharacters('honeywell'),
  };

  uiLogger.log(table(data, tableConfig));
}

export async function listSchemas(accountId: number): Promise<void> {
  const { data } = await fetchObjectSchemas(accountId);
  logSchemas(data.results);
}
