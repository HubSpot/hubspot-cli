import { Argv } from 'yargs';
import createCommand from './schema/create.js';
import fetchCommand from './schema/fetch.js';
import fetchAllCommand from './schema/fetch-all.js';
import deleteCommand from './schema/delete.js';
import listCommand from './schema/list.js';
import updateSchema from './schema/update.js';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import {
  uiDeprecatedTag,
  uiCommandRenamedDescription,
} from '../../lib/ui/index.js';

const command = ['schema', 'schemas'];
const describe = uiDeprecatedTag(
  commands.customObject.subcommands.schema.describe as string,
  false
);

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

const verboseDescribe = uiCommandRenamedDescription(
  commands.customObject.subcommands.schema.describe,
  'hs custom-object'
);

const builder = makeYargsBuilder(
  customObjectSchemaBuilder,
  command,
  verboseDescribe
);

const customObjectSchemaCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default customObjectSchemaCommand;
