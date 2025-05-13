import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { clearHubDbTableRows } from '@hubspot/local-dev-lib/hubdb';
import { publishTable } from '@hubspot/local-dev-lib/api/hubdb';
import { selectHubDBTablePrompt } from '../../lib/prompts/selectHubDBTablePrompt';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'clear [table-id]';
const describe = i18n('commands.hubdb.subcommands.clear.describe');

type HubdbClearArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { tableId?: number; dest?: string };

async function handler(
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
        i18n('commands.hubdb.subcommands.clear.logs.removedRows', {
          deletedRowCount,
          tableId,
        })
      );
      const {
        data: { rowCount },
      } = await publishTable(derivedAccountId, tableId);
      logger.log(
        i18n('commands.hubdb.subcommands.clear.logs.rowCount', {
          rowCount,
          tableId,
        })
      );
    } else {
      logger.log(
        i18n('commands.hubdb.subcommands.clear.logs.emptyTable', {
          tableId,
        })
      );
    }
  } catch (e) {
    logError(e);
  }
}

function hubdbClearBuilder(yargs: Argv): Argv<HubdbClearArgs> {
  yargs.positional('table-id', {
    describe: i18n(
      'commands.hubdb.subcommands.clear.positionals.tableId.describe'
    ),
    type: 'string',
  });

  return yargs as Argv<HubdbClearArgs>;
}

const builder = makeYargsBuilder<HubdbClearArgs>(
  hubdbClearBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const hubdbClearCommand: YargsCommandModule<unknown, HubdbClearArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default hubdbClearCommand;
