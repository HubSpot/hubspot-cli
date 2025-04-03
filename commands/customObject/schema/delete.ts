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
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../../types/Yargs';


export const command = 'delete [name]';
export const describe = i18n(`commands.customObject.subcommands.schema.subcommands.delete.describe`);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type SchemaDeleteArgs = CombinedArgs & { name?: string; force?: boolean };

export async function handler(
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
        : await listPrompt(i18n(`commands.customObject.subcommands.schema.subcommands.delete.selectSchema`), {
            choices: schemaNames,
          });

    const shouldDelete =
      force ||
      (await confirmPrompt(i18n(`commands.customObject.subcommands.schema.subcommands.delete.confirmDelete`, { name })));

    if (!shouldDelete) {
      logger.info(i18n(`commands.customObject.subcommands.schema.subcommands.delete.deleteCancelled`, { name }));
      return process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteObjectSchema(derivedAccountId, name);
    logger.success(
      i18n(`commands.customObject.subcommands.schema.subcommands.delete.success.delete`, {
        name,
      })
    );
  } catch (e) {
    logError(e);
    logger.error(
      i18n(`commands.customObject.subcommands.schema.subcommands.delete.errors.delete`, {
        name: name || '',
      })
    );
  }
}

export function builder(yargs: Argv): Argv<SchemaDeleteArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs
    .example([
      ['$0 schema delete schemaName', i18n(`commands.customObject.subcommands.schema.subcommands.delete.examples.default`)],
    ])
    .positional('name', {
      describe: i18n(`commands.customObject.subcommands.schema.subcommands.delete.positionals.name.describe`),
      type: 'string',
    })
    .option('force', {
      describe: i18n(`commands.customObject.subcommands.schema.subcommands.delete.options.force.describe`),
      type: 'boolean',
    });

  return yargs as Argv<SchemaDeleteArgs>;
}
