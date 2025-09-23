import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../../lib/ui/logger.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { listSchemas } from '../../../lib/schema.js';
import { commands } from '../../../lang/en.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'list';
const describe =
  commands.customObject.subcommands.schema.subcommands.list.describe;

type SchemaListArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;

async function handler(
  args: ArgumentsCamelCase<SchemaListArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-list', {}, derivedAccountId);

  try {
    await listSchemas(derivedAccountId);
  } catch (e) {
    logError(e);
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.list.errors.list
    );
  }
}

function schemaListBuilder(yargs: Argv): Argv<SchemaListArgs> {
  return yargs as Argv<SchemaListArgs>;
}

const builder = makeYargsBuilder<SchemaListArgs>(
  schemaListBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const schemaListCommand: YargsCommandModule<unknown, SchemaListArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default schemaListCommand;
