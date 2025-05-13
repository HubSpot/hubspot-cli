import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { downloadHubDbTable } from '@hubspot/local-dev-lib/hubdb';
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

const command = 'fetch [table-id] [dest]';
const describe = i18n('commands.hubdb.subcommands.fetch.describe');

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

    logger.success(
      i18n('commands.hubdb.subcommands.fetch.success.fetch', {
        path: filePath,
        tableId,
      })
    );
  } catch (e) {
    logError(e);
  }
}

function hubdbFetchBuilder(yargs: Argv): Argv<HubdbFetchArgs> {
  yargs.positional('table-id', {
    describe: i18n(
      'commands.hubdb.subcommands.fetch.positionals.tableId.describe'
    ),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(
      'commands.hubdb.subcommands.fetch.positionals.dest.describe'
    ),
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
