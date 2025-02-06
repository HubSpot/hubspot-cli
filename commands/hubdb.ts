import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import * as createCommand from './hubdb/create';
import * as fetchCommand from './hubdb/fetch';
import * as deleteCommand from './hubdb/delete';
import * as clearCommand from './hubdb/clear';
import { i18n } from '../lib/lang';

const i18nKey = 'commands.hubdb';

export const command = 'hubdb';
export const describe = i18n(`${i18nKey}.describe`);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs
    .command(clearCommand)
    .command(createCommand)
    .command(fetchCommand)
    .command(deleteCommand)
    .demandCommand(1, '');

  return yargs;
}
