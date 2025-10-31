import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  downloadSchemas,
  getResolvedPath,
} from '@hubspot/local-dev-lib/customObjects';
import { inputPrompt } from '../../lib/prompts/promptUtils.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { logSchemas } from '../../lib/schema.js';
import { logError } from '../../lib/errorHandlers/index.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'fetch-all-schemas [dest]';
const describe = commands.customObject.subcommands.fetchAllSchemas.describe;

export type SchemaFetchAllArgs = CommonArgs &
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
        commands.customObject.subcommands.fetchAllSchemas.inputDest
      ));
    const schemas = await downloadSchemas(derivedAccountId, dest);
    logSchemas(schemas);
    uiLogger.success(
      commands.customObject.subcommands.fetchAllSchemas.success.fetch(
        getResolvedPath(dest)
      )
    );
  } catch (e) {
    logError(e);
    uiLogger.error(
      commands.customObject.subcommands.fetchAllSchemas.errors.fetch
    );
  }
}

function schemaFetchAllBuilder(yargs: Argv): Argv<SchemaFetchAllArgs> {
  yargs
    .example([
      [
        '$0 custom-object fetch-all-schemas',
        commands.customObject.subcommands.fetchAllSchemas.examples.default,
      ],
      [
        '$0 custom-object fetch-all-schemas my/folder',
        commands.customObject.subcommands.fetchAllSchemas.examples.specifyPath,
      ],
    ])
    .positional('dest', {
      describe:
        commands.customObject.subcommands.fetchAllSchemas.positionals.dest
          .describe,
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

const fetchAllSchemasCommand: YargsCommandModule<unknown, SchemaFetchAllArgs> =
  {
    command,
    describe,
    handler,
    builder,
  };

export default fetchAllSchemasCommand;
