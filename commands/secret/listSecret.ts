import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';

import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiAccountDescription } from '../../lib/ui';
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

export const command = 'list';
export const describe = i18n(`commands.secret.subcommands.list.describe`);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs;
type ListSecretArgs = CommonArgs & CombinedArgs;

export async function handler(
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

export function builder(yargs: Argv): Argv<ListSecretArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs as Argv<ListSecretArgs>;
}
