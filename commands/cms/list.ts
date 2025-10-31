import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { isPathFolder } from '../../lib/filesystem.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { getDirectoryContentsByPath } from '@hubspot/local-dev-lib/api/fileMapper';
import { HUBSPOT_FOLDER, MARKETPLACE_FOLDER } from '../../lib/constants.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { FileMapperNode } from '@hubspot/local-dev-lib/types/Files';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

function addColorToContents(fileOrFolder: string | FileMapperNode): string {
  if (!isPathFolder(fileOrFolder as string)) {
    return chalk.reset.cyan(fileOrFolder);
  }
  if (fileOrFolder === HUBSPOT_FOLDER || fileOrFolder === MARKETPLACE_FOLDER) {
    return chalk.reset.bold.blue(fileOrFolder);
  }
  return chalk.reset.blue(fileOrFolder);
}

function sortContents(a: string, b: string): number {
  // Pin @hubspot folder to top
  if (a === HUBSPOT_FOLDER) {
    return -1;
  } else if (b === HUBSPOT_FOLDER) {
    return 1;
  }

  // Pin @marketplace folder to top
  if (a === MARKETPLACE_FOLDER) {
    return -1;
  } else if (b === MARKETPLACE_FOLDER) {
    return 1;
  }

  return a.localeCompare(b);
}

const command = ['list [path]', 'ls [path]'];
const describe = commands.cms.subcommands.list.describe;

export type ListArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & { path: string };

async function handler(args: ArgumentsCamelCase<ListArgs>): Promise<void> {
  const { path, derivedAccountId } = args;
  const directoryPath = path || '/';
  let contentsResp;

  trackCommandUsage('list', undefined, derivedAccountId);

  uiLogger.debug(
    commands.cms.subcommands.list.gettingPathContents(directoryPath)
  );

  try {
    const { data } = await getDirectoryContentsByPath(
      derivedAccountId,
      directoryPath
    );
    contentsResp = data;
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }

  if (!contentsResp.folder) {
    uiLogger.info(
      commands.cms.subcommands.list.noFilesFoundAtPath(directoryPath)
    );
    return;
  }
  // getDirectoryContentsByPath omits @hubspot
  const contents =
    directoryPath === '/'
      ? ['@hubspot', ...contentsResp.children]
      : contentsResp.children;

  if (contents.length === 0) {
    uiLogger.info(
      commands.cms.subcommands.list.noFilesFoundAtPath(directoryPath)
    );
    return;
  }

  const folderContentsOutput = contents
    .map(addColorToContents)
    .sort(sortContents)
    .join('\n');

  uiLogger.log(folderContentsOutput);
  process.exit(EXIT_CODES.SUCCESS);
}

function cmsListBuilder(yargs: Argv): Argv<ListArgs> {
  yargs.positional('path', {
    describe: commands.cms.subcommands.list.positionals.path.describe,
    type: 'string',
  });
  yargs.example([
    ['$0 cms list'],
    ['$0 cms list /'],
    ['$0 cms list my-modules'],
  ]);

  return yargs as Argv<ListArgs>;
}

const builder = makeYargsBuilder<ListArgs>(cmsListBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
  useEnvironmentOptions: true,
});

const cmsListCommand: YargsCommandModule<unknown, ListArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default cmsListCommand;
