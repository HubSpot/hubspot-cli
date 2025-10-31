import { Argv, ArgumentsCamelCase } from 'yargs';
import { moveFile } from '@hubspot/local-dev-lib/api/fileMapper';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { isPathFolder } from '../../lib/filesystem.js';
import {
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

function getCorrectedDestPath(srcPath: string, destPath: string): string {
  if (!isPathFolder(srcPath)) {
    return destPath;
  }

  // Makes sure that nested folders are moved independently
  return `${destPath}/${srcPath.split('/').pop()}`;
}

const command = 'mv <srcPath> <destPath>';
const describe = commands.cms.subcommands.mv.describe;

export type MvArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs & { srcPath: string; destPath: string };

async function handler(args: ArgumentsCamelCase<MvArgs>) {
  const { srcPath, destPath, derivedAccountId } = args;

  trackCommandUsage('mv', undefined, derivedAccountId);

  try {
    await moveFile(
      derivedAccountId,
      srcPath,
      getCorrectedDestPath(srcPath, destPath)
    );
    uiLogger.success(
      commands.cms.subcommands.mv.move(srcPath, destPath, derivedAccountId)
    );
  } catch (error) {
    uiLogger.error(
      commands.cms.subcommands.mv.errors.moveFailed(
        srcPath,
        destPath,
        derivedAccountId
      )
    );
    if (isSpecifiedError(error, { statusCode: 409 })) {
      uiLogger.error(
        commands.cms.subcommands.mv.errors.sourcePathExists(srcPath, destPath)
      );
    } else {
      logError(
        error,
        new ApiErrorContext({
          accountId: derivedAccountId,
        })
      );
    }
  }
}

function cmsMvBuilder(yargs: Argv): Argv<MvArgs> {
  yargs.positional('srcPath', {
    describe: commands.cms.subcommands.mv.positionals.srcPath.describe,
    type: 'string',
  });
  yargs.positional('destPath', {
    describe: commands.cms.subcommands.mv.positionals.destPath.describe,
    type: 'string',
  });

  return yargs as Argv<MvArgs>;
}

const builder = makeYargsBuilder<MvArgs>(cmsMvBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
  useEnvironmentOptions: true,
});

const cmsMvCommand: YargsCommandModule<unknown, MvArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default cmsMvCommand;
