import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../../lib/ui/index.js';
import { YargsCommandModule } from '../../../types/Yargs.js';
import updateSchemaCommand, { SchemaUpdateArgs } from '../updateSchema.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';

const command = 'update <name>';
const describe = uiDeprecatedTag(updateSchemaCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<SchemaUpdateArgs>) {
  uiCommandRelocatedMessage('hs custom-object update-schema');

  await updateSchemaCommand.handler(args);
}

function deprecatedUpdateSchemaBuilder(yargs: Argv): Argv<SchemaUpdateArgs> {
  yargs
    .positional('name', {
      describe:
        commands.customObject.subcommands.updateSchema.positionals.name
          .describe,
      type: 'string',
    })
    .option('path', {
      describe:
        commands.customObject.subcommands.updateSchema.options.path.describe,
      type: 'string',
      required: true,
    });

  return yargs as Argv<SchemaUpdateArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  updateSchemaCommand.describe,
  'hs custom-object update-schema'
);

const builder = makeYargsBuilder<SchemaUpdateArgs>(
  deprecatedUpdateSchemaBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: true,
  }
);

const deprecatedUpdateSchemaCommand: YargsCommandModule<
  unknown,
  SchemaUpdateArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default deprecatedUpdateSchemaCommand;
