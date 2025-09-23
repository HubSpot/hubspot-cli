import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { downloadHubDbTable } from '@hubspot/local-dev-lib/hubdb';
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

const command = 'fetch [table-id] [dest]';
const describe = commands.hubdb.subcommands.fetch.describe;

type HubdbFetchArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { tableId?: number; dest?: string };

async function handler(
  args: ArgumentsCamelCase<HubdbFetchArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('hubdb-fetch', {}, derivedAccountId);

  try {
    const promptAnswers = await selectHubDBTablePrompt({
      accountId: derivedAccountId,
      options: args,
      skipDestPrompt: false,
    });
    const tableId = args.tableId || promptAnswers.tableId;
    const dest = args.dest || promptAnswers.dest;

    const { filePath } = await downloadHubDbTable(
      derivedAccountId,
      tableId,
      dest
    );

    uiLogger.success(
      commands.hubdb.subcommands.fetch.success.fetch(tableId, filePath)
    );
  } catch (e) {
    logError(e);
  }
}

function hubdbFetchBuilder(yargs: Argv): Argv<HubdbFetchArgs> {
  yargs.positional('table-id', {
    describe: commands.hubdb.subcommands.fetch.positionals.tableId.describe,
    type: 'string',
  });

  yargs.positional('dest', {
    describe: commands.hubdb.subcommands.fetch.positionals.dest.describe,
    type: 'string',
  });

  return yargs as Argv<HubdbFetchArgs>;
}

const builder = makeYargsBuilder<HubdbFetchArgs>(
  hubdbFetchBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const hubdbFetchCommand: YargsCommandModule<unknown, HubdbFetchArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default hubdbFetchCommand;
