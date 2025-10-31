import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  downloadSchema,
  getResolvedPath,
} from '@hubspot/local-dev-lib/customObjects';

import { inputPrompt, listPrompt } from '../../lib/prompts/promptUtils.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { logError } from '../../lib/errorHandlers/index.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'fetch-schema [name] [dest]';
const describe = commands.customObject.subcommands.fetchSchema.describe;

export type SchemaFetchArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; dest?: string };

async function handler(
  args: ArgumentsCamelCase<SchemaFetchArgs>
): Promise<void> {
  const { name: providedName, dest: providedDest, derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-fetch', {}, derivedAccountId);
  let name;

  try {
    const {
      data: { results },
    } = await fetchObjectSchemas(derivedAccountId);
    const schemaNames = results?.map(({ name: schemaName }) => schemaName);

    name =
      providedName ||
      (await listPrompt(
        commands.customObject.subcommands.fetchSchema.selectSchema,
        {
          choices: schemaNames,
        }
      ));

    const dest =
      providedDest ||
      (await inputPrompt(
        commands.customObject.subcommands.fetchSchema.inputDest
      ));

    await downloadSchema(derivedAccountId, name, dest);
    uiLogger.success(
      commands.customObject.subcommands.fetchSchema.success.savedToPath(
        getResolvedPath(dest, name)
      )
    );
  } catch (e) {
    logError(e);
    uiLogger.error(
      commands.customObject.subcommands.fetchSchema.errors.fetch(name || '')
    );
  }
}

function schemaFetchBuilder(yargs: Argv): Argv<SchemaFetchArgs> {
  yargs
    .example([
      [
        '$0 custom-object fetch-schema schemaName',
        commands.customObject.subcommands.fetchSchema.examples.default,
      ],
      [
        '$0 custom-object fetch-schema schemaName my/folder',
        commands.customObject.subcommands.fetchSchema.examples.specifyPath,
      ],
    ])
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

const builder = makeYargsBuilder<SchemaFetchArgs>(
  schemaFetchBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const fetchSchemaCommand: YargsCommandModule<unknown, SchemaFetchArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default fetchSchemaCommand;
