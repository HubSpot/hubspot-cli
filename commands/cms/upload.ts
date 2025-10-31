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

import { ApiErrorContext, logError } from '../../lib/errorHandlers/index.js';
import { getCmsPublishMode } from '../../lib/commonOpts.js';
import { uploadPrompt } from '../../lib/prompts/uploadPrompt.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import { validateCmsPublishMode } from '../../lib/validation.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { getUploadableFileList } from '../../lib/upload.js';
import { commands } from '../../lang/en.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  CmsPublishModeArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';

const command = 'upload [src] [dest]';
const describe = commands.cms.subcommands.upload.describe;

function logThemePreview(filePath: string, accountId: number): void {
  const previewUrl = getThemePreviewUrl(filePath, accountId);
  // Only log if we are actually in a theme
  if (previewUrl) {
    uiLogger.log(commands.cms.subcommands.upload.previewUrl(previewUrl));
  }
}

export type UploadArgs = CommonArgs &
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
    uiLogger.error(commands.cms.subcommands.upload.errors.destinationRequired);
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
      uiLogger.error(commands.cms.subcommands.upload.errors.invalidPath(src));
      return;
    }
  } catch (e) {
    uiLogger.error(commands.cms.subcommands.upload.errors.invalidPath(src));
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
    srcDestIssues.forEach(({ message }) => uiLogger.error(message));
    process.exit(EXIT_CODES.WARNING);
  }
  if (stats.isFile()) {
    if (!isAllowedExtension(src) && !convertFields) {
      uiLogger.error(commands.cms.subcommands.upload.errors.invalidPath(src));
      return;
    }

    if (shouldIgnoreFile(absoluteSrcPath)) {
      uiLogger.error(commands.cms.subcommands.upload.errors.fileIgnored(src));
      return;
    }
    upload(
      derivedAccountId,
      absoluteSrcPath,
      normalizedDest,
      getFileMapperQueryValues(cmsPublishMode)
    )
      .then(() => {
        uiLogger.success(
          commands.cms.subcommands.upload.success.fileUploaded(
            src,
            normalizedDest,
            derivedAccountId
          )
        );
        logThemePreview(src, derivedAccountId);
      })
      .catch(error => {
        uiLogger.error(
          commands.cms.subcommands.upload.errors.uploadFailed(
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
    uiLogger.log(
      commands.cms.subcommands.upload.uploading(src, dest, derivedAccountId)
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
          commands.cms.subcommands.upload.confirmCleanUpload(
            dest,
            derivedAccountId
          ),
          { defaultAnswer: false }
        );
      }
      if (cleanUpload) {
        try {
          await deleteFile(derivedAccountId, dest);
          uiLogger.log(
            commands.cms.subcommands.upload.cleaning(dest, derivedAccountId)
          );
        } catch (error) {
          uiLogger.error(
            commands.cms.subcommands.upload.errors.deleteFailed(
              dest,
              derivedAccountId
            )
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
          uiLogger.success(
            commands.cms.subcommands.upload.success.uploadComplete(dest)
          );
          logThemePreview(src, derivedAccountId);
        } else {
          uiLogger.error(
            commands.cms.subcommands.upload.errors.someFilesFailed(dest)
          );
          process.exit(EXIT_CODES.WARNING);
        }
      })
      .catch(error => {
        uiLogger.error(
          commands.cms.subcommands.upload.errors.uploadFailed(src, dest)
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
    describe: commands.cms.subcommands.upload.positionals.src,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.cms.subcommands.upload.positionals.dest,
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: commands.cms.subcommands.upload.options.options,
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('saveOutput', {
    describe: commands.cms.subcommands.upload.options.saveOutput,
    type: 'boolean',
    default: false,
  });
  yargs.option('convertFields', {
    describe: commands.cms.subcommands.upload.options.convertFields,
    type: 'boolean',
    default: false,
  });
  yargs.option('clean', {
    describe: commands.cms.subcommands.upload.options.clean,
    type: 'boolean',
    default: false,
  });
  yargs.option('force', {
    describe: commands.cms.subcommands.upload.options.force,
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
