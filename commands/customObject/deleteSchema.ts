import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchObjectSchemas,
  deleteObjectSchema,
} from '@hubspot/local-dev-lib/api/customObjects';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { confirmPrompt, listPrompt } from '../../lib/prompts/promptUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
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

const command = 'delete-schema [name]';
const describe = commands.customObject.subcommands.deleteSchema.describe;

export type SchemaDeleteArgs = CommonArgs &
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
            commands.customObject.subcommands.deleteSchema.selectSchema,
            {
              choices: schemaNames,
            }
          );

    const shouldDelete =
      force ||
      (await confirmPrompt(
        commands.customObject.subcommands.deleteSchema.confirmDelete(name)
      ));

    if (!shouldDelete) {
      uiLogger.info(
        commands.customObject.subcommands.deleteSchema.deleteCancelled(name)
      );
      return process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteObjectSchema(derivedAccountId, name);
    uiLogger.success(
      commands.customObject.subcommands.deleteSchema.success.delete(name)
    );
  } catch (e) {
    logError(e);
    uiLogger.error(
      commands.customObject.subcommands.deleteSchema.errors.delete(name || '')
    );
  }
}

function schemaDeleteBuilder(yargs: Argv): Argv<SchemaDeleteArgs> {
  yargs
    .example([
      [
        '$0 custom-object delete-schema schemaName',
        commands.customObject.subcommands.deleteSchema.examples.default,
      ],
    ])
    .positional('name', {
      describe:
        commands.customObject.subcommands.deleteSchema.positionals.name
          .describe,
      type: 'string',
    })
    .option('force', {
      describe:
        commands.customObject.subcommands.deleteSchema.options.force.describe,
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

const deleteSchemaCommand: YargsCommandModule<unknown, SchemaDeleteArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default deleteSchemaCommand;
