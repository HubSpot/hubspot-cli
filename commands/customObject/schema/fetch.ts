import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../../lib/ui/index.js';
import { YargsCommandModule } from '../../../types/Yargs.js';
import fetchSchemaCommand, { SchemaFetchArgs } from '../fetchSchema.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';

const command = 'fetch <name> [dest]';
const describe = uiDeprecatedTag(fetchSchemaCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<SchemaFetchArgs>) {
  uiCommandRelocatedMessage('hs custom-object fetch-schema');

  await fetchSchemaCommand.handler(args);
}

function deprecatedFetchSchemaBuilder(yargs: Argv): Argv<SchemaFetchArgs> {
  yargs
    .positional('name', {
      describe:
        commands.customObject.subcommands.fetchSchema.positionals.name.describe,
      type: 'string',
    })
    .positional('dest', {
      describe:
        commands.customObject.subcommands.fetchSchema.positionals.dest.describe,
      type: 'string',
    });

  return yargs as Argv<SchemaFetchArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  fetchSchemaCommand.describe,
  'hs custom-object fetch-schema'
);

const builder = makeYargsBuilder<SchemaFetchArgs>(
  deprecatedFetchSchemaBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedFetchSchemaCommand: YargsCommandModule<
  unknown,
  SchemaFetchArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default deprecatedFetchSchemaCommand;
