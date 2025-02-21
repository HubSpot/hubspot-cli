import { Argv } from 'yargs';
import * as createCommand from './schema/create';
import * as fetchCommand from './schema/fetch';
import * as fetchAllCommand from './schema/fetch-all';
import * as deleteCommand from './schema/delete';
import * as listCommand from './schema/list';
import * as updateSchema from './schema/update';
import { i18n } from '../../lib/lang';

const i18nKey = 'commands.customObject.subcommands.schema';

export const command = ['schema', 'schemas'];
export const describe = i18n(`${i18nKey}.describe`);

export function builder(yargs: Argv): Argv {
  yargs
    .command(listCommand)
    .command(fetchCommand)
    .command(fetchAllCommand)
    .command(createCommand)
    .command(updateSchema)
    .command(deleteCommand)
    .demandCommand(1, '');

  return yargs;
}
