import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { moveFile } from '@hubspot/local-dev-lib/api/fileMapper';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { logError, ApiErrorContext } from '../lib/errorHandlers/index';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} from '../lib/commonOpts';
import { trackCommandUsage } from '../lib/usageTracking';
import { isPathFolder } from '../lib/filesystem';
import { i18n } from '../lib/lang';
import { uiBetaTag } from '../lib/ui';
import { CommonArgs, ConfigArgs, EnvironmentArgs } from '../types/Yargs';

function getCorrectedDestPath(srcPath: string, destPath: string): string {
  if (!isPathFolder(srcPath)) {
    return destPath;
  }

  // Makes sure that nested folders are moved independently
  return `${destPath}/${srcPath.split('/').pop()}`;
}

export const command = 'mv <srcPath> <destPath>';
export const describe = uiBetaTag(i18n(`commands.mv.describe`), false);

type MvArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs & { srcPath: string; destPath: string };

export async function handler(args: ArgumentsCamelCase<MvArgs>) {
  const { srcPath, destPath, derivedAccountId } = args;

  trackCommandUsage('mv', undefined, derivedAccountId);

  try {
    await moveFile(
      derivedAccountId,
      srcPath,
      getCorrectedDestPath(srcPath, destPath)
    );
    logger.success(
      i18n(`commands.mv.move`, {
        accountId: derivedAccountId,
        destPath,
        srcPath,
      })
    );
  } catch (error) {
    logger.error(
      i18n(`commands.mv.errors.moveFailed`, {
        accountId: derivedAccountId,
        destPath,
        srcPath,
      })
    );
    if (isSpecifiedError(error, { statusCode: 409 })) {
      logger.error(
        i18n(`commands.mv.errors.sourcePathExists`, {
          destPath,
          srcPath,
        })
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

export function builder(yargs: Argv): Argv<MvArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  yargs.positional('srcPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  yargs.positional('destPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });

  return yargs as Argv<MvArgs>;
}
