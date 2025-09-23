import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { uiLogger } from '../../../lib/ui/logger.js';
import {
  downloadSchema,
  getResolvedPath,
} from '@hubspot/local-dev-lib/customObjects';

import { inputPrompt, listPrompt } from '../../../lib/prompts/promptUtils.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'fetch [name] [dest]';
const describe =
  commands.customObject.subcommands.schema.subcommands.fetch.describe;

type SchemaFetchArgs = CommonArgs &
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
        commands.customObject.subcommands.schema.subcommands.fetch.selectSchema,
        {
          choices: schemaNames,
        }
      ));

    const dest =
      providedDest ||
      (await inputPrompt(
        commands.customObject.subcommands.schema.subcommands.fetch.inputDest
      ));

    await downloadSchema(derivedAccountId, name, dest);
    uiLogger.success(
      commands.customObject.subcommands.schema.subcommands.fetch.success.savedToPath(
        getResolvedPath(dest, name)
      )
    );
  } catch (e) {
    logError(e);
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.fetch.errors.fetch(
        name || ''
      )
    );
  }
}

function schemaFetchBuilder(yargs: Argv): Argv<SchemaFetchArgs> {
  yargs
    .example([
      [
        '$0 custom-object schema fetch schemaName',
        commands.customObject.subcommands.schema.subcommands.fetch.examples
          .default,
      ],
      [
        '$0 custom-object schema fetch schemaName my/folder',
        commands.customObject.subcommands.schema.subcommands.fetch.examples
          .specifyPath,
      ],
    ])
    .positional('name', {
      describe:
        commands.customObject.subcommands.schema.subcommands.fetch.positionals
          .name.describe,
      type: 'string',
    })
    .positional('dest', {
      describe:
        commands.customObject.subcommands.schema.subcommands.fetch.positionals
          .dest.describe,
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

const schemaFetchCommand: YargsCommandModule<unknown, SchemaFetchArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default schemaFetchCommand;
