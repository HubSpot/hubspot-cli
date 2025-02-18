import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';

import { uploadFolder } from '@hubspot/local-dev-lib/fileManager';
import { uploadFile } from '@hubspot/local-dev-lib/api/fileManager';
import { getCwd, convertToUnixPath } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { validateSrcAndDestPaths } from '@hubspot/local-dev-lib/cms/modules';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';

import { ApiErrorContext, logError } from '../../lib/errorHandlers/index';
import {
  addConfigOptions,
  addGlobalOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.filemanager.subcommands.upload';

export const command = 'upload <src> <dest>';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type FileManagerUploadArgs = CombinedArgs & {
  src: string;
  dest: string;
};

export async function handler(
  args: ArgumentsCamelCase<FileManagerUploadArgs>
): Promise<void> {
  const { src, dest, derivedAccountId } = args;

  const absoluteSrcPath = path.resolve(getCwd(), src);

  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      logger.error(
        i18n(`${i18nKey}.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!dest) {
    logger.error(i18n(`${i18nKey}.errors.destinationRequired`));
    return;
  }
  const normalizedDest = convertToUnixPath(dest);
  trackCommandUsage(
    'filemanager-upload',
    { type: stats.isFile() ? 'file' : 'folder' },
    derivedAccountId
  );

  const srcDestIssues = await validateSrcAndDestPaths(
    { isLocal: true, path: src },
    { isHubSpot: true, path: dest }
  );
  if (srcDestIssues.length) {
    srcDestIssues.forEach(({ message }) => logger.error(message));
    process.exit(EXIT_CODES.ERROR);
  }

  if (stats.isFile()) {
    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(
        i18n(`${i18nKey}.errors.fileIgnored`, {
          path: src,
        })
      );
      return;
    }

    uploadFile(derivedAccountId, absoluteSrcPath, normalizedDest)
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.upload`, {
            accountId: derivedAccountId,
            dest: normalizedDest,
            src,
          })
        );
      })
      .catch(error => {
        logger.error(
          i18n(`${i18nKey}.errors.upload`, {
            dest: normalizedDest,
            src,
          })
        );
        logError(
          error,
          new ApiErrorContext({
            accountId: derivedAccountId,
            request: normalizedDest,
            payload: src,
          })
        );
      });
  } else {
    logger.log(
      i18n(`${i18nKey}.logs.uploading`, {
        accountId: derivedAccountId,
        dest,
        src,
      })
    );
    uploadFolder(derivedAccountId, absoluteSrcPath, dest)
      .then(() => {
        logger.success(
          i18n(`${i18nKey}.success.uploadComplete`, {
            dest,
          })
        );
      })
      .catch(error => {
        logger.error(i18n(`${i18nKey}.errors.uploadingFailed`));
        logError(error, {
          accountId: derivedAccountId,
        });
      });
  }
}

export function builder(yargs: Argv): Argv<FileManagerUploadArgs> {
  addGlobalOptions(yargs);
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });

  return yargs as Argv<FileManagerUploadArgs>;
}
