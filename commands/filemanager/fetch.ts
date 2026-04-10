import { Argv, ArgumentsCamelCase } from 'yargs';
import { downloadFileOrFolder } from '@hubspot/local-dev-lib/fileManager';
import { uiLogger } from '../../lib/ui/logger.js';
import { resolveLocalPath } from '../../lib/filesystem.js';
import { commands } from '../../lang/en.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { addOverwriteOptions } from '../../lib/commonOpts.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  OverwriteArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'fetch <src> [dest]';
const describe = commands.filemanager.subcommands.fetch.describe;

type FileManagerFetchArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  OverwriteArgs & {
    src: string;
    dest: string;
    includeArchived?: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<FileManagerFetchArgs>
): Promise<void> {
  const { src, includeArchived, derivedAccountId, overwrite, exit } = args;

  if (typeof src !== 'string') {
    uiLogger.error(
      commands.filemanager.subcommands.fetch.errors.sourceRequired
    );
    return exit(EXIT_CODES.ERROR);
  }

  const dest = resolveLocalPath(args.dest);

  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      derivedAccountId,
      src,
      dest,
      overwrite,
      includeArchived || false
    );
  } catch (err) {
    logError(err);
    return exit(EXIT_CODES.ERROR);
  }
}

function fileManagerFetchBuilder(yargs: Argv): Argv<FileManagerFetchArgs> {
  addOverwriteOptions(yargs);

  yargs.positional('src', {
    describe: commands.filemanager.subcommands.fetch.positionals.src.describe,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.filemanager.subcommands.fetch.positionals.dest.describe,
    type: 'string',
  });
  yargs.option('include-archived', {
    alias: ['i'],
    describe:
      commands.filemanager.subcommands.fetch.options.includeArchived.describe,
    type: 'boolean',
  });

  return yargs as Argv<FileManagerFetchArgs>;
}

const builder = makeYargsBuilder<FileManagerFetchArgs>(
  fileManagerFetchBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const fileManagerFetchCommand: YargsCommandModule<
  unknown,
  FileManagerFetchArgs
> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('filemanager-fetch', handler),
  builder,
};

export default fileManagerFetchCommand;
