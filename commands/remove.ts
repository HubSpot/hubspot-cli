import { Argv, ArgumentsCamelCase } from 'yargs';
import { deleteFile } from '@hubspot/local-dev-lib/api/fileMapper';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError, ApiErrorContext } from '../lib/errorHandlers/index';
import { trackCommandUsage } from '../lib/usageTracking';
import { i18n } from '../lib/lang';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = 'remove <path>';
const describe = i18n(`commands.remove.describe`);

type RemoveArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & { path: string };

async function handler(args: ArgumentsCamelCase<RemoveArgs>): Promise<void> {
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

function cmsRemoveBuilder(yargs: Argv): Argv<RemoveArgs> {
  yargs.positional('path', {
    describe: i18n(`commands.remove.positionals.path.describe`),
    type: 'string',
  });

  return yargs as Argv<RemoveArgs>;
}

const builder = makeYargsBuilder<RemoveArgs>(
  cmsRemoveBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const cmsRemoveCommand: YargsCommandModule<unknown, RemoveArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default cmsRemoveCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = cmsRemoveCommand;
