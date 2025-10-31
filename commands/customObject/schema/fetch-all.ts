import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../../lib/ui/index.js';
import { YargsCommandModule } from '../../../types/Yargs.js';
import fetchAllSchemasCommand, {
  SchemaFetchAllArgs,
} from '../fetchAllSchemas.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';

const command = 'fetch-all [dest]';
const describe = uiDeprecatedTag(
  fetchAllSchemasCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<SchemaFetchAllArgs>) {
  uiCommandRelocatedMessage('hs custom-object fetch-all-schemas');

  await fetchAllSchemasCommand.handler(args);
}

function deprecatedFetchAllSchemasBuilder(
  yargs: Argv
): Argv<SchemaFetchAllArgs> {
  yargs.positional('dest', {
    describe:
      commands.customObject.subcommands.fetchAllSchemas.positionals.dest
        .describe,
    type: 'string',
  });

  return yargs as Argv<SchemaFetchAllArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  fetchAllSchemasCommand.describe,
  'hs custom-object fetch-all-schemas'
);

const builder = makeYargsBuilder<SchemaFetchAllArgs>(
  deprecatedFetchAllSchemasBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedFetchAllSchemasCommand: YargsCommandModule<
  unknown,
  SchemaFetchAllArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default deprecatedFetchAllSchemasCommand;
