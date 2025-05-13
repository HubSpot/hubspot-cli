import { Argv, ArgumentsCamelCase } from 'yargs';
import { deleteFile } from '@hubspot/local-dev-lib/api/fileMapper';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError, ApiErrorContext } from '../lib/errorHandlers/index';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} from '../lib/commonOpts';
import { trackCommandUsage } from '../lib/usageTracking';
import { i18n } from '../lib/lang';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../types/Yargs';

export const command = 'remove <path>';
export const describe = i18n(`commands.remove.describe`);

type RemoveArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & { path: string };

export async function handler(
  args: ArgumentsCamelCase<RemoveArgs>
): Promise<void> {
  const { path: hsPath, derivedAccountId } = args;

  trackCommandUsage('remove', undefined, derivedAccountId);

  try {
    await deleteFile(derivedAccountId, hsPath);
    logger.log(
      i18n(`commands.remove.deleted`, {
        accountId: derivedAccountId,
        path: hsPath,
      })
    );
  } catch (error) {
    logger.error(
      i18n(`commands.remove.errors.deleteFailed`, {
        accountId: derivedAccountId,
        path: hsPath,
      })
    );
    logError(
      error,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: hsPath,
      })
    );
  }
}

export function builder(yargs: Argv): Argv<RemoveArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  yargs.positional('path', {
    describe: i18n(`commands.remove.positionals.path.describe`),
    type: 'string',
  });

  return yargs as Argv<RemoveArgs>;
}
