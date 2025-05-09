import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { AxiosError } from 'axios';

import { watch } from '@hubspot/local-dev-lib/cms/watch';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';

import { getCmsPublishMode } from '../lib/commonOpts';
import { uploadPrompt } from '../lib/prompts/uploadPrompt';
import { validateCmsPublishMode } from '../lib/validation';
import { trackCommandUsage } from '../lib/usageTracking';
import { i18n } from '../lib/lang';
import { getUploadableFileList } from '../lib/upload';
import { logError, ApiErrorContext } from '../lib/errorHandlers';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { makeYargsBuilder } from '../lib/yargsUtils';
import {
  AccountArgs,
  CmsPublishModeArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../types/Yargs';
import { WatchErrorHandler } from '@hubspot/local-dev-lib/types/Files';

type WatchCommandArgs = ConfigArgs &
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
const describe = i18n(`commands.watch.describe`);

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
      logger.log(
        i18n(`commands.watch.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.log(
      i18n(`commands.watch.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!dest) {
    logger.log(i18n(`commands.watch.errors.destinationRequired`));
    return;
  }

  let filesToUpload: string[] = [];

  if (disableInitial) {
    logger.info(i18n(`commands.watch.warnings.disableInitial`));
  } else if (!initialUpload) {
    logger.info(i18n(`commands.watch.warnings.notUploaded`, { path: src }));
    logger.info(i18n(`commands.watch.warnings.initialUpload`));
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
    logger.error(
      i18n(`commands.watch.errors.folderFailed`, {
        src,
        dest,
        accountId: derivedAccountId,
      })
    );
    logError(error, {
      accountId: derivedAccountId,
    });
  };

  const onUploadFileError =
    (file: string, destPath: string, accountId: number) =>
    (error: Error | AxiosError) => {
      logger.error(
        i18n(`commands.watch.errors.fileFailed`, {
          file,
          dest: destPath,
          accountId,
        })
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
    describe: i18n(`commands.watch.positionals.src.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`commands.watch.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: i18n(`commands.watch.options.options.describe`),
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('remove', {
    alias: 'r',
    describe: i18n(`commands.watch.options.remove.describe`),
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: i18n(`commands.watch.options.initialUpload.describe`),
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    describe: i18n(`commands.watch.options.disableInitial.describe`),
    type: 'boolean',
    hidden: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe: i18n(`commands.watch.options.notify.describe`),
    type: 'string',
    requiresArg: true,
  });
  yargs.option('convertFields', {
    describe: i18n(`commands.watch.options.convertFields.describe`),
    type: 'boolean',
    default: false,
  });
  yargs.option('saveOutput', {
    describe: i18n(`commands.watch.options.saveOutput.describe`),
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

module.exports = watchCommand;
