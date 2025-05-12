import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchObjectSchemas,
  deleteObjectSchema,
} from '@hubspot/local-dev-lib/api/customObjects';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils';
import { logger } from '@hubspot/local-dev-lib/logger';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logError } from '../../../lib/errorHandlers';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';

const command = 'delete [name]';
const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.delete.describe`
);

type SchemaDeleteArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; force?: boolean };

async function handler(
  args: ArgumentsCamelCase<SchemaDeleteArgs>
): Promise<void> {
  const { name: providedName, force, derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-delete', {}, derivedAccountId);

  let name;
  try {
    const {
      data: { results },
    } = await fetchObjectSchemas(derivedAccountId);
    const schemaNames = results?.map(({ name: schemaName }) => schemaName);
    name =
      providedName && typeof providedName === 'string'
        ? providedName
        : await listPrompt(
            i18n(
              `commands.customObject.subcommands.schema.subcommands.delete.selectSchema`
            ),
            {
              choices: schemaNames,
            }
          );

    const shouldDelete =
      force ||
      (await confirmPrompt(
        i18n(
          `commands.customObject.subcommands.schema.subcommands.delete.confirmDelete`,
          { name }
        )
      ));

    if (!shouldDelete) {
      logger.info(
        i18n(
          `commands.customObject.subcommands.schema.subcommands.delete.deleteCancelled`,
          { name }
        )
      );
      return process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteObjectSchema(derivedAccountId, name);
    logger.success(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.delete.success.delete`,
        {
          name,
        }
      )
    );
  } catch (e) {
    logError(e);
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.delete.errors.delete`,
        {
          name: name || '',
        }
      )
    );
  }
}

function schemaDeleteBuilder(yargs: Argv): Argv<SchemaDeleteArgs> {
  yargs
    .example([
      [
        '$0 schema delete schemaName',
        i18n(
          `commands.customObject.subcommands.schema.subcommands.delete.examples.default`
        ),
      ],
    ])
    .positional('name', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.delete.positionals.name.describe`
      ),
      type: 'string',
    })
    .option('force', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.delete.options.force.describe`
      ),
      type: 'boolean',
    });

  return yargs as Argv<SchemaDeleteArgs>;
}

const builder = makeYargsBuilder<SchemaDeleteArgs>(
  schemaDeleteBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const schemaDeleteCommand: YargsCommandModule<unknown, SchemaDeleteArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default schemaDeleteCommand;
