import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../../lib/ui/logger.js';
import {
  downloadSchemas,
  getResolvedPath,
} from '@hubspot/local-dev-lib/customObjects';
import { inputPrompt } from '../../../lib/prompts/promptUtils.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { logSchemas } from '../../../lib/schema.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'fetch-all [dest]';
const describe =
  commands.customObject.subcommands.schema.subcommands.fetchAll.describe;

type SchemaFetchAllArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { dest?: string };

async function handler(
  args: ArgumentsCamelCase<SchemaFetchAllArgs>
): Promise<void> {
  const { derivedAccountId, dest: providedDest } = args;

  trackCommandUsage('custom-object-schema-fetch-all', {}, derivedAccountId);

  try {
    const dest =
      providedDest ||
      (await inputPrompt(
        commands.customObject.subcommands.schema.subcommands.fetchAll.inputDest
      ));
    const schemas = await downloadSchemas(derivedAccountId, dest);
    logSchemas(schemas);
    uiLogger.success(
      commands.customObject.subcommands.schema.subcommands.fetchAll.success.fetch(
        getResolvedPath(dest)
      )
    );
  } catch (e) {
    logError(e);
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.fetchAll.errors.fetch
    );
  }
}

function schemaFetchAllBuilder(yargs: Argv): Argv<SchemaFetchAllArgs> {
  yargs
    .example([
      [
        '$0 custom-object schema fetch-all',
        commands.customObject.subcommands.schema.subcommands.fetchAll.examples
          .default,
      ],
      [
        '$0 custom-object schema fetch-all my/folder',
        commands.customObject.subcommands.schema.subcommands.fetchAll.examples
          .specifyPath,
      ],
    ])
    .positional('dest', {
      describe:
        commands.customObject.subcommands.schema.subcommands.fetchAll
          .positionals.dest.describe,
      type: 'string',
    });

  return yargs as Argv<SchemaFetchAllArgs>;
}

const builder = makeYargsBuilder<SchemaFetchAllArgs>(
  schemaFetchAllBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const schemaFetchAllCommand: YargsCommandModule<unknown, SchemaFetchAllArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default schemaFetchAllCommand;
