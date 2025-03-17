import { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import {
  addAccountOptions,
  addConfigOptions,
  addGlobalOptions,
  addUseEnvironmentOptions,
} from '../lib/commonOpts';
import { trackCommandUsage } from '../lib/usageTracking';
import { isPathFolder } from '../lib/filesystem';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../lib/errorHandlers/index';
import { getDirectoryContentsByPath } from '@hubspot/local-dev-lib/api/fileMapper';
import { HUBSPOT_FOLDER, MARKETPLACE_FOLDER } from '../lib/constants';
import { i18n } from '../lib/lang';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../types/Yargs';
import { FileMapperNode } from '@hubspot/local-dev-lib/types/Files';

const i18nKey = 'commands.list';

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

export const command = 'list [path]';
export const describe = i18n(`${i18nKey}.describe`);

type ListArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & { path: string };

export async function handler(
  args: ArgumentsCamelCase<ListArgs>
): Promise<void> {
  const { path, derivedAccountId } = args;
  const directoryPath = path || '/';
  let contentsResp;

  trackCommandUsage('list', undefined, derivedAccountId);

  logger.debug(
    i18n(`${i18nKey}.gettingPathContents`, {
      path: directoryPath,
    })
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
    logger.info(
      i18n(`${i18nKey}.noFilesFoundAtPath`, {
        path: directoryPath,
      })
    );
    return;
  }
  // getDirectoryContentsByPath omits @hubspot
  const contents =
    directoryPath === '/'
      ? ['@hubspot', ...contentsResp.children]
      : contentsResp.children;

  if (contents.length === 0) {
    logger.info(
      i18n(`${i18nKey}.noFilesFoundAtPath`, {
        path: directoryPath,
      })
    );
    return;
  }

  const folderContentsOutput = contents
    .map(addColorToContents)
    .sort(sortContents)
    .join('\n');

  logger.log(folderContentsOutput);
  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<ListArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  yargs.example([['$0 list'], ['$0 list /'], ['$0 list serverless']]);

  return yargs as Argv<ListArgs>;
}
