import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../../lib/ui/index.js';
import { YargsCommandModule } from '../../../types/Yargs.js';
import listSchemaCommand, { SchemaListArgs } from '../listSchemas.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'list';
const describe = uiDeprecatedTag(listSchemaCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<SchemaListArgs>) {
  uiCommandRelocatedMessage('hs custom-object list-schemas');

  await listSchemaCommand.handler(args);
}

function deprecatedListSchemaBuilder(yargs: Argv): Argv<SchemaListArgs> {
  return yargs as Argv<SchemaListArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  listSchemaCommand.describe,
  'hs custom-object list-schemas'
);

const builder = makeYargsBuilder<SchemaListArgs>(
  deprecatedListSchemaBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedListSchemaCommand: YargsCommandModule<unknown, SchemaListArgs> =
  {
    command,
    describe,
    handler,
    builder,
  };

export default deprecatedListSchemaCommand;
