import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { deleteTable } from '@hubspot/local-dev-lib/api/hubdb';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { selectHubDBTablePrompt } from '../../lib/prompts/selectHubDBTablePrompt';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.hubdb.subcommands.delete';

export const command = 'delete [table-id]';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs;
type HubdbDeleteArgs = CommonArgs &
  CombinedArgs & { tableId?: number; dest?: string };

export async function handler(
  args: ArgumentsCamelCase<HubdbDeleteArgs>
): Promise<void> {
  const { force, derivedAccountId } = args;

  trackCommandUsage('hubdb-delete', {}, derivedAccountId);

  try {
    const { tableId } =
      'tableId' in args && args.tableId
        ? args
        : await selectHubDBTablePrompt({
            accountId: derivedAccountId,
            options: args,
          });

    if (!force) {
      const { shouldDeleteTable } = await promptUser({
        name: 'shouldDeleteTable',
        type: 'confirm',
        message: i18n(`${i18nKey}.shouldDeleteTable`, { tableId }),
      });

      if (!shouldDeleteTable) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteTable(derivedAccountId, tableId);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountId: derivedAccountId,
        tableId,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        tableId: args.tableId || '',
      })
    );
    logError(e);
  }
}

export function builder(yargs: Argv): Argv<HubdbDeleteArgs> {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('table-id', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });

  yargs.option('force', {
    describe: i18n(`${i18nKey}.options.force.describe`),
    type: 'boolean',
  });

  return yargs as Argv<HubdbDeleteArgs>;
}
