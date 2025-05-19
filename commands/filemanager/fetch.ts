import { Argv, ArgumentsCamelCase } from 'yargs';
import { downloadFileOrFolder } from '@hubspot/local-dev-lib/fileManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { resolveLocalPath } from '../../lib/filesystem';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { logError } from '../../lib/errorHandlers/index';
import { addOverwriteOptions } from '../../lib/commonOpts';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  OverwriteArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'fetch <src> [dest]';
const describe = i18n(`commands.filemanager.subcommands.fetch.describe`);

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
  const { src, includeArchived, derivedAccountId, overwrite } = args;

  if (typeof src !== 'string') {
    logger.error(
      i18n(`commands.filemanager.subcommands.fetch.errors.sourceRequired`)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const dest = resolveLocalPath(args.dest);

  trackCommandUsage('filemanager-fetch', {}, derivedAccountId);

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
    process.exit(EXIT_CODES.ERROR);
  }
}

function fileManagerFetchBuilder(yargs: Argv): Argv<FileManagerFetchArgs> {
  addOverwriteOptions(yargs);

  yargs.positional('src', {
    describe: i18n(
      `commands.filemanager.subcommands.fetch.positionals.src.describe`
    ),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(
      `commands.filemanager.subcommands.fetch.positionals.dest.describe`
    ),
    type: 'string',
  });
  yargs.option('include-archived', {
    alias: ['i'],
    describe: i18n(
      `commands.filemanager.subcommands.fetch.options.includeArchived.describe`
    ),
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
  handler,
  builder,
};

export default fileManagerFetchCommand;
