import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../../lib/ui/index.js';
import { YargsCommandModule } from '../../../types/Yargs.js';
import createSchemaCommand, { SchemaCreateArgs } from '../createSchema.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';

const command = 'create';
const describe = uiDeprecatedTag(createSchemaCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<SchemaCreateArgs>) {
  uiCommandRelocatedMessage('hs custom-object create-schema');

  await createSchemaCommand.handler(args);
}

function deprecatedCreateSchemaBuilder(yargs: Argv): Argv<SchemaCreateArgs> {
  yargs.option('path', {
    describe:
      commands.customObject.subcommands.createSchema.options.definition
        .describe,
    type: 'string',
    required: true,
  });

  return yargs as Argv<SchemaCreateArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  createSchemaCommand.describe,
  'hs custom-object create-schema'
);

const builder = makeYargsBuilder<SchemaCreateArgs>(
  deprecatedCreateSchemaBuilder,
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

const deprecatedCreateSchemaCommand: YargsCommandModule<
  unknown,
  SchemaCreateArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default deprecatedCreateSchemaCommand;
