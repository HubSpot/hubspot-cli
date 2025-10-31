import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { AxiosError } from 'axios';

import { watch } from '@hubspot/local-dev-lib/cms/watch';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { getCmsPublishMode } from '../../lib/commonOpts.js';
import { uploadPrompt } from '../../lib/prompts/uploadPrompt.js';
import { validateCmsPublishMode } from '../../lib/validation.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { getUploadableFileList } from '../../lib/upload.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import {
  AccountArgs,
  CmsPublishModeArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { WatchErrorHandler } from '@hubspot/local-dev-lib/types/Files';
import { uiLogger } from '../../lib/ui/logger.js';

export type WatchCommandArgs = ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  CommonArgs &
  CmsPublishModeArgs & {
    src?: string;
    dest?: string;
    fieldOptions?: string[];
    remove?: boolean;
    initialUpload?: boolean;
    disableInitial?: boolean;
    notify?: string;
    convertFields?: boolean;
    saveOutput?: boolean;
  };

const command = 'watch [src] [dest]';
const describe = commands.cms.subcommands.watch.describe;

const handler = async (
  args: ArgumentsCamelCase<WatchCommandArgs>
): Promise<void> => {
  const { remove, initialUpload, disableInitial, notify, derivedAccountId } =
    args;

  if (!validateCmsPublishMode(args)) {
    process.exit(EXIT_CODES.ERROR);
  }

  const cmsPublishMode = getCmsPublishMode(args);

  const uploadPromptAnswers = await uploadPrompt(args);

  const src = args.src || uploadPromptAnswers.src;
  const dest = args.dest || uploadPromptAnswers.dest;

  const absoluteSrcPath = path.resolve(getCwd(), src);
  try {
    const stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      uiLogger.log(commands.cms.subcommands.watch.errors.invalidPath(src));
      return;
    }
  } catch (e) {
    uiLogger.log(commands.cms.subcommands.watch.errors.invalidPath(src));
    return;
  }

  if (!dest) {
    uiLogger.log(commands.cms.subcommands.watch.errors.destinationRequired);
    return;
  }

  let filesToUpload: string[] = [];

  if (disableInitial) {
    uiLogger.info(commands.cms.subcommands.watch.warnings.disableInitial);
  } else if (!initialUpload) {
    uiLogger.info(commands.cms.subcommands.watch.warnings.notUploaded(src));
    uiLogger.info(commands.cms.subcommands.watch.warnings.initialUpload);
  }

  if (initialUpload) {
    filesToUpload = await getUploadableFileList(
      absoluteSrcPath,
      args.convertFields
    );
  }

  trackCommandUsage('watch', { mode: cmsPublishMode }, derivedAccountId);

  const onUploadFolderError: WatchErrorHandler = (
    error: Error | AxiosError
  ) => {
    uiLogger.error(
      commands.cms.subcommands.watch.errors.folderFailed(
        src,
        dest,
        derivedAccountId
      )
    );
    logError(error, {
      accountId: derivedAccountId,
    });
  };

  const onUploadFileError =
    (file: string, destPath: string, accountId: number) =>
    (error: Error | AxiosError) => {
      uiLogger.error(
        commands.cms.subcommands.watch.errors.fileFailed(
          file,
          destPath,
          accountId
        )
      );
      logError(
        error,
        new ApiErrorContext({
          accountId,
          request: destPath,
          payload: file,
        })
      );
    };

  watch(
    derivedAccountId,
    absoluteSrcPath,
    dest,
    {
      cmsPublishMode,
      remove,
      disableInitial: !initialUpload,
      notify,
      commandOptions: args,
      filePaths: filesToUpload,
    },
    null,
    onUploadFolderError,
    undefined,
    onUploadFileError
  );
};

function watchBuilder(yargs: Argv): Argv<WatchCommandArgs> {
  yargs.positional('src', {
    describe: commands.cms.subcommands.watch.positionals.src,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.cms.subcommands.watch.positionals.dest,
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: commands.cms.subcommands.watch.options.options,
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('remove', {
    alias: 'r',
    describe: commands.cms.subcommands.watch.options.remove,
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: commands.cms.subcommands.watch.options.initialUpload,
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    describe: commands.cms.subcommands.watch.options.disableInitial,
    type: 'boolean',
    hidden: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe: commands.cms.subcommands.watch.options.notify,
    type: 'string',
    requiresArg: true,
  });
  yargs.option('convertFields', {
    describe: commands.cms.subcommands.watch.options.convertFields,
    type: 'boolean',
    default: false,
  });
  yargs.option('saveOutput', {
    describe: commands.cms.subcommands.watch.options.saveOutput,
    type: 'boolean',
    default: false,
  });

  return yargs as Argv<WatchCommandArgs>;
}

const builder = makeYargsBuilder<WatchCommandArgs>(
  watchBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useGlobalOptions: true,
    useEnvironmentOptions: true,
    useCmsPublishModeOptions: { write: true },
  }
);

const watchCommand: YargsCommandModule<unknown, WatchCommandArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default watchCommand;
