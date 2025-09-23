import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';

import { uploadFolder } from '@hubspot/local-dev-lib/fileManager';
import { uploadFile } from '@hubspot/local-dev-lib/api/fileManager';
import { getCwd, convertToUnixPath } from '@hubspot/local-dev-lib/path';
import { uiLogger } from '../../lib/ui/logger.js';
import { validateSrcAndDestPaths } from '@hubspot/local-dev-lib/cms/modules';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'upload <src> <dest>';
const describe = commands.filemanager.subcommands.upload.describe;

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
      uiLogger.error(
        commands.filemanager.subcommands.upload.errors.invalidPath(src)
      );
      return;
    }
  } catch (e) {
    uiLogger.error(
      commands.filemanager.subcommands.upload.errors.invalidPath(src)
    );
    return;
  }

  if (!dest) {
    uiLogger.error(
      commands.filemanager.subcommands.upload.errors.destinationRequired
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
    srcDestIssues.forEach(({ message }) => uiLogger.error(message));
    process.exit(EXIT_CODES.ERROR);
  }

  if (stats.isFile()) {
    if (shouldIgnoreFile(absoluteSrcPath)) {
      uiLogger.error(
        commands.filemanager.subcommands.upload.errors.fileIgnored(src)
      );
      return;
    }

    uploadFile(derivedAccountId, absoluteSrcPath, normalizedDest)
      .then(() => {
        uiLogger.success(
          commands.filemanager.subcommands.upload.success.upload(
            src,
            normalizedDest,
            derivedAccountId
          )
        );
      })
      .catch(error => {
        uiLogger.error(
          commands.filemanager.subcommands.upload.errors.upload(
            src,
            normalizedDest
          )
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
    uiLogger.log(
      commands.filemanager.subcommands.upload.logs.uploading(
        src,
        dest,
        derivedAccountId
      )
    );
    uploadFolder(derivedAccountId, absoluteSrcPath, dest)
      .then(() => {
        uiLogger.success(
          commands.filemanager.subcommands.upload.success.uploadComplete(dest)
        );
      })
      .catch(error => {
        uiLogger.error(
          commands.filemanager.subcommands.upload.errors.uploadingFailed
        );
        logError(error, {
          accountId: derivedAccountId,
        });
      });
  }
}

function fileManagerUploadBuilder(yargs: Argv): Argv<FileManagerUploadArgs> {
  yargs.positional('src', {
    describe: commands.filemanager.subcommands.upload.positionals.src.describe,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.filemanager.subcommands.upload.positionals.dest.describe,
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
