import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { listSchemas } from '../../../lib/schema';
import { i18n } from '../../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';

const command = 'list';
const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.list.describe`
);

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
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.list.errors.list`
      )
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
