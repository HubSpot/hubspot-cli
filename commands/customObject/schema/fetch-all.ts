import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  downloadSchemas,
  getResolvedPath,
} from '@hubspot/local-dev-lib/customObjects';

import { inputPrompt } from '../../../lib/prompts/promptUtils';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logSchemas } from '../../../lib/schema';
import { logError } from '../../../lib/errorHandlers';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../../types/Yargs';

export const command = 'fetch-all [dest]';
export const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.fetchAll.describe`
);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type SchemaFetchAllArgs = CombinedArgs & { dest?: string };

export async function handler(
  args: ArgumentsCamelCase<SchemaFetchAllArgs>
): Promise<void> {
  const { derivedAccountId, dest: providedDest } = args;

  trackCommandUsage('custom-object-schema-fetch-all', {}, derivedAccountId);

  try {
    const dest =
      providedDest ||
      (await inputPrompt(
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetchAll.inputDest`
        )
      ));
    const schemas = await downloadSchemas(derivedAccountId, dest);
    logSchemas(schemas);
    logger.success(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.fetchAll.success.fetch`,
        {
          path: getResolvedPath(dest),
        }
      )
    );
  } catch (e) {
    logError(e);
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.fetchAll.errors.fetch`
      )
    );
  }
}

export function builder(yargs: Argv): Argv<SchemaFetchAllArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs
    .example([
      [
        '$0 custom-object schema fetch-all',
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetchAll.examples.default`
        ),
      ],
      [
        '$0 custom-object schema fetch-all my/folder',
        i18n(
          `commands.customObject.subcommands.schema.subcommands.fetchAll.examples.specifyPath`
        ),
      ],
    ])
    .positional('dest', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.fetchAll.positionals.dest.describe`
      ),
      type: 'string',
    });

  return yargs as Argv<SchemaFetchAllArgs>;
}
