import { Argv, ArgumentsCamelCase } from 'yargs';
import { downloadFileOrFolder } from '@hubspot/local-dev-lib/fileManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { resolveLocalPath } from '../../lib/filesystem';
import {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addGlobalOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { logError } from '../../lib/errorHandlers/index';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  OverwriteArgs,
} from '../../types/Yargs';

export const command = 'fetch <src> [dest]';
export const describe = i18n(`commands.filemanager.subcommands.fetch.describe`);

type CombinedArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  OverwriteArgs;
type FileManagerFetchArgs = CombinedArgs & {
  src: string;
  dest: string;
  includeArchived?: boolean;
};

export async function handler(
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

export function builder(yargs: Argv): Argv<FileManagerFetchArgs> {
  addGlobalOptions(yargs);
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addOverwriteOptions(yargs);
  addUseEnvironmentOptions(yargs);

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
