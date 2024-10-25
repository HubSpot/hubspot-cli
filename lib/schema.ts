import chalk from 'chalk';
import { table, getBorderCharacters } from 'table';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { Schema } from '@hubspot/local-dev-lib/types/Schemas';

export function logSchemas(schemas: Array<Schema>): void {
  const data = schemas
    .map(r => [r.labels.singular, r.name, r.objectTypeId || ''])
    .sort((a, b) => (a[1] > b[1] ? 1 : -1));
  data.unshift([
    chalk.bold('Label'),
    chalk.bold('Name'),
    chalk.bold('objectTypeId'),
  ]);

  const tableConfig = {
    singleLine: true,
    border: getBorderCharacters('honeywell'),
  };

  logger.log(data.length ? table(data, tableConfig) : 'No Schemas were found');
}

export async function listSchemas(accountId: number): Promise<void> {
  const { data } = await fetchObjectSchemas(accountId);
  logSchemas(data.results);
}
