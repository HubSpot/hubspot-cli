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
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';

const command = 'fetch-all [dest]';
const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.fetchAll.describe`
);

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

function schemaFetchAllBuilder(yargs: Argv): Argv<SchemaFetchAllArgs> {
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
