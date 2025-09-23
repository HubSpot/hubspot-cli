import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { clearHubDbTableRows } from '@hubspot/local-dev-lib/hubdb';
import { publishTable } from '@hubspot/local-dev-lib/api/hubdb';
import { selectHubDBTablePrompt } from '../../lib/prompts/selectHubDBTablePrompt.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'clear [table-id]';
const describe = commands.hubdb.subcommands.clear.describe;

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
      uiLogger.log(
        commands.hubdb.subcommands.clear.logs.removedRows(
          deletedRowCount,
          tableId
        )
      );
      const {
        data: { rowCount },
      } = await publishTable(derivedAccountId, tableId);
      uiLogger.log(
        commands.hubdb.subcommands.clear.logs.rowCount(tableId, rowCount)
      );
    } else {
      uiLogger.log(commands.hubdb.subcommands.clear.logs.tableEmpty(tableId));
    }
  } catch (e) {
    logError(e);
  }
}

function hubdbClearBuilder(yargs: Argv): Argv<HubdbClearArgs> {
  yargs.positional('table-id', {
    describe: commands.hubdb.subcommands.clear.positionals.tableId.describe,
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
