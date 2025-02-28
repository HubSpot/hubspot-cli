import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import cliProgress from 'cli-progress';
import { i18n } from '../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { FILE_UPLOAD_RESULT_TYPES } from '@hubspot/local-dev-lib/constants/files';
import { getThemeJSONPath } from '@hubspot/local-dev-lib/cms/themes';
import { preview } from '@hubspot/theme-preview-dev-server';
import { UploadFolderResults } from '@hubspot/local-dev-lib/types/Files';

import { addAccountOptions, addConfigOptions } from '../../lib/commonOpts';
import { getUploadableFileList } from '../../lib/upload';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  previewPrompt,
  previewProjectPrompt,
} from '../../lib/prompts/previewPrompt';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index';
import { handleExit, handleKeypress } from '../../lib/process';
import { getProjectConfig } from '../../lib/projects';
import { findProjectComponents } from '../../lib/projects/structure';
import { ComponentTypes } from '../../types/Projects';
import { hasFeature } from '../../lib/hasFeature';
import { CommonArgs, ConfigArgs, AccountArgs } from '../../types/Yargs';

const i18nKey = 'commands.theme.subcommands.preview';

export const command = 'preview [--src] [--dest]';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs;
type ThemePreviewArgs = CombinedArgs & {
  src: string;
  dest: string;
  notify: string;
  'no-ssl'?: boolean;
  port?: number;
  resetSession?: boolean;
  generateFieldsTypes?: boolean;
};

function validateSrcPath(src: string): boolean {
  const logInvalidPath = () => {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: src,
      })
    );
  };
  try {
    const stats = fs.statSync(src);
    if (!stats.isDirectory()) {
      logInvalidPath();
      return false;
    }
  } catch (e) {
    logInvalidPath();
    return false;
  }
  return true;
}

function handleUserInput(): void {
  const onTerminate = () => {
    logger.log(i18n(`${i18nKey}.logs.processExited`));
    process.exit(EXIT_CODES.SUCCESS);
  };

  handleExit(onTerminate);
  handleKeypress(key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      onTerminate();
    }
  });
}
async function determineSrcAndDest(args: ThemePreviewArgs): Promise<{
  absoluteSrc: string;
  dest: string;
}> {
  let absoluteSrc;
  let dest;
  const { projectDir, projectConfig } = await getProjectConfig();
  if (!(projectDir && projectConfig)) {
    // Not in a project, prompt for src and dest of traditional theme
    const previewPromptAnswers = await previewPrompt(args);
    const src = args.src || previewPromptAnswers.src;
    dest = args.dest || previewPromptAnswers.dest;
    absoluteSrc = path.resolve(getCwd(), src);
    if (!dest || !validateSrcPath(absoluteSrc)) {
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    // In a project
    let themeJsonPath = getThemeJSONPath(getCwd());
    if (!themeJsonPath) {
      const projectComponents = await findProjectComponents(projectDir);
      const themeComponents = projectComponents.filter(
        c => c.type === ComponentTypes.HublTheme
      );
      if (themeComponents.length === 0) {
        logger.error(i18n(`${i18nKey}.errors.noThemeComponents`));
        process.exit(EXIT_CODES.ERROR);
      }
      const answer = await previewProjectPrompt(themeComponents);
      themeJsonPath = `${answer.themeComponentPath}/theme.json`;
    }
    const { dir: themeDir } = path.parse(themeJsonPath);
    absoluteSrc = themeDir;
    const { base: themeName } = path.parse(themeDir);
    dest = `@projects/${projectConfig.name}/${themeName}`;
  }
  return { absoluteSrc, dest };
}

export async function handler(
  args: ArgumentsCamelCase<ThemePreviewArgs>
): Promise<void> {
  const {
    derivedAccountId,
    notify,
    noSsl,
    resetSession,
    port,
    generateFieldsTypes,
  } = args;

  const { absoluteSrc, dest } = await determineSrcAndDest(args);

  const filePaths = await getUploadableFileList(absoluteSrc, false);

  function startProgressBar(numFiles: number): {
    onAttemptCallback: () => void;
    onSuccessCallback: () => void;
    onFirstErrorCallback: () => void;
    onRetryCallback: () => void;
    onFinalErrorCallback: () => void;
    onFinishCallback: (results: UploadFolderResults[]) => void;
  } {
    const initialUploadProgressBar = new cliProgress.SingleBar(
      {
        gracefulExit: true,
        format: '[{bar}] {percentage}% | {value}/{total} | {label}',
        hideCursor: true,
      },
      cliProgress.Presets.rect
    );
    initialUploadProgressBar.start(numFiles, 0, {
      label: i18n(`${i18nKey}.initialUploadProgressBar.start`),
    });
    let uploadsHaveStarted = false;
    const uploadOptions = {
      onAttemptCallback: () => {
        /* Intentionally blank */
      },
      onSuccessCallback: () => {
        initialUploadProgressBar.increment();
        if (!uploadsHaveStarted) {
          uploadsHaveStarted = true;
          initialUploadProgressBar.update(0, {
            label: i18n(`${i18nKey}.initialUploadProgressBar.uploading`),
          });
        }
      },
      onFirstErrorCallback: () => {
        /* Intentionally blank */
      },
      onRetryCallback: () => {
        /* Intentionally blank */
      },
      onFinalErrorCallback: () => initialUploadProgressBar.increment(),
      onFinishCallback: (results: UploadFolderResults[]) => {
        initialUploadProgressBar.update(numFiles, {
          label: i18n(`${i18nKey}.initialUploadProgressBar.finish`),
        });
        initialUploadProgressBar.stop();
        results.forEach(result => {
          if (result.resultType == FILE_UPLOAD_RESULT_TYPES.FAILURE) {
            logger.error(
              'Uploading file "%s" to "%s" failed',
              result.file,
              dest
            );
            logError(
              result.error,
              new ApiErrorContext({
                accountId: derivedAccountId,
                request: dest,
                payload: result.file,
              })
            );
          }
        });
      },
    };
    return uploadOptions;
  }

  trackCommandUsage('preview', {}, derivedAccountId);

  let createUnifiedDevServer;
  try {
    // @ts-ignore TODO: Remove when we deprecate Node 18
    require.resolve('@hubspot/cms-dev-server');
    const { createDevServer } = await import('@hubspot/cms-dev-server');
    createUnifiedDevServer = createDevServer;
  } catch (e) {
    logger.warn(
      'Unified dev server requires node 20 to run. Defaulting to legacy preview.'
    );
  }

  const isUngatedForUnified = await hasFeature(
    derivedAccountId,
    'cms:react:unifiedThemePreview'
  );
  if (isUngatedForUnified && createUnifiedDevServer) {
    if (port) {
      process.env['PORT'] = port.toString();
    }
    createUnifiedDevServer(
      absoluteSrc,
      false,
      '',
      '',
      !noSsl,
      generateFieldsTypes,
      {
        filePaths,
        resetSession: resetSession || false,
        startProgressBar,
        dest,
      }
    );
  } else {
    preview(derivedAccountId, absoluteSrc, dest, {
      notify,
      filePaths,
      noSsl,
      port,
      resetSession: resetSession || false,
      startProgressBar,
      handleUserInput,
    });
  }
}

export function builder(yargs: Argv): Argv<ThemePreviewArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs
    .option('src', {
      describe: i18n(`${i18nKey}.options.src.describe`),
      type: 'string',
      requiresArg: true,
    })
    .option('dest', {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
      requiresArg: true,
    })
    .option('notify', {
      alias: 'n',
      describe: i18n(`${i18nKey}.options.notify.describe`),
      type: 'string',
      requiresArg: true,
    })
    .option('no-ssl', {
      describe: i18n(`${i18nKey}.options.noSsl.describe`),
      type: 'boolean',
    })
    .option('port', {
      describe: i18n(`${i18nKey}.options.port.describe`),
      type: 'number',
    })
    .option('resetSession', {
      hidden: true,
      type: 'boolean',
    })
    .option('generateFieldsTypes', {
      hidden: true,
      type: 'boolean',
    });

  return yargs as Argv<ThemePreviewArgs>;
}
