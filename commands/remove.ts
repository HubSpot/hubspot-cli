import { Argv, ArgumentsCamelCase } from 'yargs';
import { deleteFile } from '@hubspot/local-dev-lib/api/fileMapper';
import { logError, ApiErrorContext } from '../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../lib/usageTracking.js';
import { commands } from '../lang/en.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { uiLogger } from '../lib/ui/logger.js';

const command = 'remove <path>';
const describe = commands.remove.describe;

type RemoveArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & { path: string };

async function handler(args: ArgumentsCamelCase<RemoveArgs>): Promise<void> {
  const { path: hsPath, derivedAccountId } = args;

  trackCommandUsage('remove', undefined, derivedAccountId);

  try {
    await deleteFile(derivedAccountId, hsPath);
    uiLogger.log(commands.remove.deleted(hsPath, derivedAccountId));
  } catch (error) {
    uiLogger.error(
      commands.remove.errors.deleteFailed(hsPath, derivedAccountId)
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
    describe: commands.remove.positionals.path,
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
