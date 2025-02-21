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

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.delete';

export const command = 'delete [name]';
export const describe = i18n(`${i18nKey}.describe`);

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
        : await listPrompt(i18n(`${i18nKey}.selectSchema`), {
            choices: schemaNames,
          });

    const shouldDelete =
      force ||
      (await confirmPrompt(i18n(`${i18nKey}.confirmDelete`, { name })));

    if (!shouldDelete) {
      logger.info(i18n(`${i18nKey}.deleteCancelled`, { name }));
      return process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteObjectSchema(derivedAccountId, name);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        name,
      })
    );
  } catch (e) {
    logError(e);
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        name: name || '',
      })
    );
  }
}

export function builder(yargs: Argv): Argv<SchemaDeleteArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.example([
    ['$0 schema delete schemaName', i18n(`${i18nKey}.examples.default`)],
  ]);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.option('force', {
    describe: i18n(`${i18nKey}.options.force.describe`),
    type: 'boolean',
  });

  return yargs as Argv<SchemaDeleteArgs>;
}
