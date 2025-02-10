import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { downloadHubDbTable } from '@hubspot/local-dev-lib/hubdb';
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

const i18nKey = 'commands.hubdb.subcommands.fetch';

export const command = 'fetch [table-id] [dest]';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs;
type HubdbFetchArgs = CommonArgs &
  CombinedArgs & { tableId?: number; dest?: string };

export async function handler(
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
      i18n(`${i18nKey}.success.fetch`, {
        path: filePath,
        tableId,
      })
    );
  } catch (e) {
    logError(e);
  }
}

export function builder(yargs: Argv): Argv<HubdbFetchArgs> {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('table-id', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });

  return yargs as Argv<HubdbFetchArgs>;
}
