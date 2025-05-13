import { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import path from 'path';
import {
  uploadFolder,
  hasUploadErrors,
} from '@hubspot/local-dev-lib/cms/uploadFolder';
import { getFileMapperQueryValues } from '@hubspot/local-dev-lib/fileMapper';
import { upload, deleteFile } from '@hubspot/local-dev-lib/api/fileMapper';
import {
  getCwd,
  convertToUnixPath,
  isAllowedExtension,
} from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { validateSrcAndDestPaths } from '@hubspot/local-dev-lib/cms/modules';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import {
  getThemePreviewUrl,
  getThemeJSONPath,
} from '@hubspot/local-dev-lib/cms/themes';
import {
  FieldsJs,
  isConvertableFieldJs,
  cleanupTmpDirSync,
} from '@hubspot/local-dev-lib/cms/handleFieldsJS';

import { ApiErrorContext, logError } from '../lib/errorHandlers/index';
import { getCmsPublishMode } from '../lib/commonOpts';
import { uploadPrompt } from '../lib/prompts/uploadPrompt';
import { confirmPrompt } from '../lib/prompts/promptUtils';
import { validateCmsPublishMode } from '../lib/validation';
import { trackCommandUsage } from '../lib/usageTracking';
import { getUploadableFileList } from '../lib/upload';
import { i18n } from '../lib/lang';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  CmsPublishModeArgs,
  YargsCommandModule,
} from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = 'upload [src] [dest]';
const describe = i18n('commands.upload.describe');

function logThemePreview(filePath: string, accountId: number): void {
  const previewUrl = getThemePreviewUrl(filePath, accountId);
  // Only log if we are actually in a theme
  if (previewUrl) {
    logger.log(
      i18n('commands.upload.previewUrl', {
        previewUrl,
      })
    );
  }
}

type UploadArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  CmsPublishModeArgs & {
    src?: string;
    dest?: string;
    fieldOptions?: string | string[];
    saveOutput?: boolean;
    convertFields?: boolean;
    clean?: boolean;
    force?: boolean;
  };

async function handler(args: ArgumentsCamelCase<UploadArgs>): Promise<void> {
  if (!validateCmsPublishMode(args)) {
    process.exit(EXIT_CODES.WARNING);
  }

  const { derivedAccountId } = args;
  const cmsPublishMode = getCmsPublishMode(args);

  const uploadPromptAnswers = await uploadPrompt(args);
  const src = args.src || uploadPromptAnswers.src;
  const saveOutput = args.saveOutput;
  let dest = args.dest || uploadPromptAnswers.dest;
  let absoluteSrcPath = path.resolve(getCwd(), src);
  if (!dest) {
    logger.error(i18n('commands.upload.errors.destinationRequired'));
    return;
  }
  // Check for theme.json file and determine the root path for the project based on it if it exists
  const themeJsonPath = getThemeJSONPath(absoluteSrcPath);
  const projectRoot = themeJsonPath
    ? path.dirname(themeJsonPath)
    : path.dirname(getCwd());
  const convertFields =
    projectRoot &&
    isConvertableFieldJs(projectRoot, absoluteSrcPath, args.convertFields);
  let fieldsJs: FieldsJs | undefined;
  if (convertFields) {
    fieldsJs = await new FieldsJs(
      projectRoot,
      absoluteSrcPath,
      undefined,
      args.fieldOptions
    ).init();
    if (fieldsJs.rejected) return;
    // Ensures that the dest path is a .json. The user might pass '.js' accidentally - this ensures it just works.
    if (fieldsJs.outputPath) {
      absoluteSrcPath = fieldsJs.outputPath;
    }
    dest = path.join(path.dirname(dest), 'fields.json');
  }
  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      logger.error(
        i18n('commands.upload.errors.invalidPath', {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.error(
      i18n('commands.upload.errors.invalidPath', {
        path: src,
      })
    );
    return;
  }

  const normalizedDest = convertToUnixPath(dest);
  trackCommandUsage(
    'upload',
    { mode: cmsPublishMode, type: stats.isFile() ? 'file' : 'folder' },
    derivedAccountId
  );
  const srcDestIssues = await validateSrcAndDestPaths(
    { isLocal: true, path: src },
    { isHubSpot: true, path: dest }
  );

  if (srcDestIssues.length) {
    srcDestIssues.forEach(({ message }) => logger.error(message));
    process.exit(EXIT_CODES.WARNING);
  }
  if (stats.isFile()) {
    if (!isAllowedExtension(src) && !convertFields) {
      logger.error(
        i18n('commands.upload.errors.invalidPath', {
          path: src,
        })
      );
      return;
    }

    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(
        i18n('commands.upload.errors.fileIgnored', {
          path: src,
        })
      );
      return;
    }
    upload(
      derivedAccountId,
      absoluteSrcPath,
      normalizedDest,
      getFileMapperQueryValues(cmsPublishMode)
    )
      .then(() => {
        logger.success(
          i18n('commands.upload.success.fileUploaded', {
            accountId: derivedAccountId,
            dest: normalizedDest,
            src,
          })
        );
        logThemePreview(src, derivedAccountId);
      })
      .catch(error => {
        logger.error(
          i18n('commands.upload.errors.uploadFailed', {
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
        process.exit(EXIT_CODES.WARNING);
      })
      .finally(() => {
        if (!convertFields) return;
        if (saveOutput && fieldsJs) {
          fieldsJs.saveOutput();
        }
        if (fieldsJs) {
          cleanupTmpDirSync(fieldsJs.rootWriteDir);
        }
      });
  } else {
    logger.log(
      i18n('commands.upload.uploading', {
        accountId: derivedAccountId,
        dest,
        src,
      })
    );

    // Generate the first-pass file list in here, and pass to uploadFolder.
    const filePaths = await getUploadableFileList(
      absoluteSrcPath,
      args.convertFields ?? false
    );

    if (args.clean) {
      //  If clean is true, will first delete the dest folder and then upload src. Cleans up files that only exist on HS.
      let cleanUpload = args.force;
      if (!args.force) {
        cleanUpload = await confirmPrompt(
          i18n('commands.upload.confirmCleanUpload', {
            accountId: derivedAccountId,
            path: dest,
          }),
          { defaultAnswer: false }
        );
      }
      if (cleanUpload) {
        try {
          await deleteFile(derivedAccountId, dest);
          logger.log(
            i18n('commands.upload.cleaning', {
              accountId: derivedAccountId,
              filePath: dest,
            })
          );
        } catch (error) {
          logger.error(
            i18n('commands.upload.errors.deleteFailed', {
              accountId: derivedAccountId,
              path: dest,
            })
          );
        }
      }
    }
    uploadFolder(
      derivedAccountId,
      absoluteSrcPath,
      dest,
      {},
      {
        convertFields: args.convertFields,
        // @ts-expect-error - fieldOptions is a string or string[]
        fieldOptions: args.fieldOptions ?? undefined,
        saveOutput: args.saveOutput,
      },
      filePaths
    )
      .then(results => {
        if (!hasUploadErrors(results)) {
          logger.success(
            i18n('commands.upload.success.uploadComplete', {
              dest,
            })
          );
          logThemePreview(src, derivedAccountId);
        } else {
          logger.error(
            i18n('commands.upload.errors.someFilesFailed', {
              dest,
            })
          );
          process.exit(EXIT_CODES.WARNING);
        }
      })
      .catch(error => {
        logger.error(
          i18n('commands.upload.errors.uploadFailed', {
            dest,
            src,
          })
        );
        logError(error, {
          accountId: derivedAccountId,
        });
        process.exit(EXIT_CODES.WARNING);
      });
  }
}

function uploadBuilder(yargs: Argv): Argv<UploadArgs> {
  yargs.positional('src', {
    describe: i18n('commands.upload.positionals.src.describe'),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n('commands.upload.positionals.dest.describe'),
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: i18n('commands.upload.options.options.describe'),
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('saveOutput', {
    describe: i18n('commands.upload.options.saveOutput.describe'),
    type: 'boolean',
    default: false,
  });
  yargs.option('convertFields', {
    describe: i18n('commands.upload.options.convertFields.describe'),
    type: 'boolean',
    default: false,
  });
  yargs.option('clean', {
    describe: i18n('commands.upload.options.clean.describe'),
    type: 'boolean',
    default: false,
  });
  yargs.option('force', {
    describe: i18n('commands.upload.options.force.describe'),
    type: 'boolean',
    default: false,
  });

  return yargs as Argv<UploadArgs>;
}

const builder = makeYargsBuilder<UploadArgs>(uploadBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
  useEnvironmentOptions: true,
  useCmsPublishModeOptions: true,
});

const uploadCommand: YargsCommandModule<unknown, UploadArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default uploadCommand;

// TODO remove this after cli.ts is ported to TS
module.exports = uploadCommand;
