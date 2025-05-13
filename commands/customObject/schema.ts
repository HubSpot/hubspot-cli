import { Argv } from 'yargs';
import createCommand from './schema/create';
import fetchCommand from './schema/fetch';
import fetchAllCommand from './schema/fetch-all';
import deleteCommand from './schema/delete';
import listCommand from './schema/list';
import updateSchema from './schema/update';
import { i18n } from '../../lib/lang';
import { YargsCommandModuleBucket } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = ['schema', 'schemas'];
const describe = i18n(`commands.customObject.subcommands.schema.describe`);

function customObjectSchemaBuilder(yargs: Argv): Argv {
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

const builder = makeYargsBuilder(customObjectSchemaBuilder, command, describe);

const customObjectSchemaCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default customObjectSchemaCommand;
