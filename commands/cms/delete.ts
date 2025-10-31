import { Argv, ArgumentsCamelCase } from 'yargs';
import { deleteFile } from '@hubspot/local-dev-lib/api/fileMapper';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';

const command = 'delete <path>';
const describe = commands.cms.subcommands.delete.describe;

export type DeleteArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & { path: string };

async function handler(args: ArgumentsCamelCase<DeleteArgs>): Promise<void> {
  const { path: hsPath, derivedAccountId } = args;

  trackCommandUsage('delete', undefined, derivedAccountId);

  try {
    await deleteFile(derivedAccountId, hsPath);
    uiLogger.log(
      commands.cms.subcommands.delete.deleted(hsPath, derivedAccountId)
    );
  } catch (error) {
    uiLogger.error(
      commands.cms.subcommands.delete.errors.deleteFailed(
        hsPath,
        derivedAccountId
      )
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

function cmsDeleteBuilder(yargs: Argv): Argv<DeleteArgs> {
  yargs.positional('path', {
    describe: commands.cms.subcommands.delete.positionals.path,
    type: 'string',
  });

  return yargs as Argv<DeleteArgs>;
}

const builder = makeYargsBuilder<DeleteArgs>(
  cmsDeleteBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const cmsDeleteCommand: YargsCommandModule<unknown, DeleteArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default cmsDeleteCommand;
