import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiAccountDescription } from '../../lib/ui';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'list';
const describe = i18n(`commands.secret.subcommands.list.describe`);

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
    const groupLabel = i18n(`commands.secret.subcommands.list.groupLabel`, {
      accountIdentifier: uiAccountDescription(derivedAccountId),
    });
    logger.group(groupLabel);
    results.forEach(secret => logger.log(secret));
    logger.groupEnd();
  } catch (err) {
    logger.error(i18n(`commands.secret.subcommands.list.errors.list`));
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
