import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../../lib/ui/index.js';
import { YargsCommandModule } from '../../../types/Yargs.js';
import deleteSchemaCommand, { SchemaDeleteArgs } from '../deleteSchema.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';

const command = 'delete <name>';
const describe = uiDeprecatedTag(deleteSchemaCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<SchemaDeleteArgs>) {
  uiCommandRelocatedMessage('hs custom-object delete-schema');

  await deleteSchemaCommand.handler(args);
}

function deprecatedDeleteSchemaBuilder(yargs: Argv): Argv<SchemaDeleteArgs> {
  yargs
    .positional('name', {
      describe:
        commands.customObject.subcommands.deleteSchema.positionals.name
          .describe,
      type: 'string',
    })
    .option('force', {
      describe:
        commands.customObject.subcommands.deleteSchema.options.force.describe,
      type: 'boolean',
    });

  return yargs as Argv<SchemaDeleteArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  deleteSchemaCommand.describe,
  'hs custom-object delete-schema'
);

const builder = makeYargsBuilder<SchemaDeleteArgs>(
  deprecatedDeleteSchemaBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedDeleteSchemaCommand: YargsCommandModule<
  unknown,
  SchemaDeleteArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default deprecatedDeleteSchemaCommand;
