import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { uiAccountDescription } from '../../lib/ui/index.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'list';
const describe = commands.secret.subcommands.list.describe;

type ListSecretArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;

async function handler(
  args: ArgumentsCamelCase<ListSecretArgs>
): Promise<void> {
  const { derivedAccountId } = args;
  trackCommandUsage('secrets-list', {}, derivedAccountId);

  try {
    const {
      data: { results },
    } = await fetchSecrets(derivedAccountId);
    const groupLabel = commands.secret.subcommands.list.groupLabel(
      uiAccountDescription(derivedAccountId)
    );
    uiLogger.group(groupLabel);
    results.forEach(secret => uiLogger.log(secret));
    uiLogger.groupEnd();
  } catch (err) {
    uiLogger.error(commands.secret.subcommands.list.errors.list);
    logError(
      err,
      new ApiErrorContext({
        request: 'add secret',
        accountId: derivedAccountId,
      })
    );
  }
}

function listSecretBuilder(yargs: Argv): Argv<ListSecretArgs> {
  return yargs as Argv<ListSecretArgs>;
}

const builder = makeYargsBuilder<ListSecretArgs>(
  listSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const listSecretCommand: YargsCommandModule<unknown, ListSecretArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default listSecretCommand;
