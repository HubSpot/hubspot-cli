import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { clearHubDbTableRows } from '@hubspot/local-dev-lib/hubdb';
import { publishTable } from '@hubspot/local-dev-lib/api/hubdb';
import { selectHubDBTablePrompt } from '../../lib/prompts/selectHubDBTablePrompt';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.hubdb.subcommands.clear';

export const command = 'clear [table-id]';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs;
type HubdbClearArgs = CommonArgs &
  CombinedArgs & { tableId?: number; dest?: string };

export async function handler(
  args: ArgumentsCamelCase<HubdbClearArgs>
): Promise<void> {
  const { derivedAccountId } = args;
  trackCommandUsage('hubdb-clear', {}, derivedAccountId);

  try {
    const { tableId } =
      'tableId' in args
        ? args
        : await selectHubDBTablePrompt({
            accountId: derivedAccountId,
            options: args,
          });

    const { deletedRowCount } = await clearHubDbTableRows(
      derivedAccountId,
      tableId
    );
    if (deletedRowCount > 0) {
      logger.log(
        i18n(`${i18nKey}.logs.removedRows`, {
          deletedRowCount,
          tableId,
        })
      );
      const {
        data: { rowCount },
      } = await publishTable(derivedAccountId, tableId);
      logger.log(
        i18n(`${i18nKey}.logs.rowCount`, {
          rowCount,
          tableId,
        })
      );
    } else {
      logger.log(
        i18n(`${i18nKey}.logs.emptyTable`, {
          tableId,
        })
      );
    }
  } catch (e) {
    logError(e);
  }
}

export function builder(yargs: Argv): Argv<HubdbClearArgs> {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('table-id', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });

  return yargs as Argv<HubdbClearArgs>;
}
