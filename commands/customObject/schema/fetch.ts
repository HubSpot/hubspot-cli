import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  downloadSchema,
  getResolvedPath,
} from '@hubspot/local-dev-lib/customObjects';

import { inputPrompt, listPrompt } from '../../../lib/prompts/promptUtils';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logError } from '../../../lib/errorHandlers';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../../types/Yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';

export const command = 'fetch [name] [dest]';
export const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.fetch.describe`
);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type SchemaFetchArgs = CombinedArgs & { name?: string; dest?: string };

export async function handler(
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
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetch.selectSchema`
        ),
        {
          choices: schemaNames,
        }
      ));

    const dest =
      providedDest ||
      (await inputPrompt(
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetch.inputDest`
        )
      ));

    await downloadSchema(derivedAccountId, name, dest);
    logger.success(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.fetch.success.savedToPath`,
        {
          path: getResolvedPath(dest, name),
        }
      )
    );
  } catch (e) {
    logError(e);
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.fetch.errors.fetch`,
        {
          name: name || '',
        }
      )
    );
  }
}

export function builder(yargs: Argv): Argv<SchemaFetchArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs
    .example([
      [
        '$0 custom-object schema fetch schemaName',
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetch.examples.default`
        ),
      ],
      [
        '$0 custom-object schema fetch schemaName my/folder',
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetch.examples.specifyPath`
        ),
      ],
    ])
    .positional('name', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.fetch.positionals.name.describe`
      ),
      type: 'string',
    })
    .positional('dest', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.fetch.positionals.dest.describe`
      ),
      type: 'string',
    });

  return yargs as Argv<SchemaFetchArgs>;
}
