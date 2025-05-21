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
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'upload <src> <dest>';
const describe = i18n(`commands.filemanager.subcommands.upload.describe`);

type FileManagerUploadArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    src: string;
    dest: string;
  };

async function handler(
  args: ArgumentsCamelCase<FileManagerUploadArgs>
): Promise<void> {
  const { src, dest, derivedAccountId } = args;

  const absoluteSrcPath = path.resolve(getCwd(), src);

  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      logger.error(
        i18n(`commands.filemanager.subcommands.upload.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.error(
      i18n(`commands.filemanager.subcommands.upload.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!dest) {
    logger.error(
      i18n(`commands.filemanager.subcommands.upload.errors.destinationRequired`)
    );
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
        i18n(`commands.filemanager.subcommands.upload.errors.fileIgnored`, {
          path: src,
        })
      );
      return;
    }

    uploadFile(derivedAccountId, absoluteSrcPath, normalizedDest)
      .then(() => {
        logger.success(
          i18n(`commands.filemanager.subcommands.upload.success.upload`, {
            accountId: derivedAccountId,
            dest: normalizedDest,
            src,
          })
        );
      })
      .catch(error => {
        logger.error(
          i18n(`commands.filemanager.subcommands.upload.errors.upload`, {
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
      i18n(`commands.filemanager.subcommands.upload.logs.uploading`, {
        accountId: derivedAccountId,
        dest,
        src,
      })
    );
    uploadFolder(derivedAccountId, absoluteSrcPath, dest)
      .then(() => {
        logger.success(
          i18n(
            `commands.filemanager.subcommands.upload.success.uploadComplete`,
            {
              dest,
            }
          )
        );
      })
      .catch(error => {
        logger.error(
          i18n(`commands.filemanager.subcommands.upload.errors.uploadingFailed`)
        );
        logError(error, {
          accountId: derivedAccountId,
        });
      });
  }
}

function fileManagerUploadBuilder(yargs: Argv): Argv<FileManagerUploadArgs> {
  yargs.positional('src', {
    describe: i18n(
      `commands.filemanager.subcommands.upload.positionals.src.describe`
    ),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(
      `commands.filemanager.subcommands.upload.positionals.dest.describe`
    ),
    type: 'string',
  });

  return yargs as Argv<FileManagerUploadArgs>;
}

const builder = makeYargsBuilder<FileManagerUploadArgs>(
  fileManagerUploadBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const fileManagerUploadCommand: YargsCommandModule<
  unknown,
  FileManagerUploadArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default fileManagerUploadCommand;
