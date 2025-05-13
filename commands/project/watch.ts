import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  cancelStagedBuild,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { useV3Api } from '../../lib/projects/buildAndDeploy';
import { uiCommandReference, uiLink, uiBetaTag } from '../../lib/ui';
import { i18n } from '../../lib/lang';
import { createWatcher } from '../../lib/projects/watch';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { PROJECT_ERROR_TYPES } from '../../lib/constants';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  getProjectConfig,
  projectConfigIsValid,
} from '../../lib/projects/config';
import { logFeedbackMessage } from '../../lib/projects/ui';
import { handleProjectUpload } from '../../lib/projects/upload';
import {
  pollBuildStatus,
  pollDeployStatus,
} from '../../lib/projects/buildAndDeploy';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { handleKeypress, handleExit } from '../../lib/process';
import {
  CommonArgs,
  AccountArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'watch';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.watch.describe`),
  false
);

type ProjectWatchArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    initialUpload?: boolean;
  };

async function handleBuildStatus(
  accountId: number,
  projectName: string,
  buildId: number
): Promise<void> {
  const { isAutoDeployEnabled, deployStatusTaskLocator } =
    await pollBuildStatus(accountId, projectName, buildId, null);

  if (isAutoDeployEnabled && deployStatusTaskLocator) {
    await pollDeployStatus(
      accountId,
      projectName,
      Number(deployStatusTaskLocator.id),
      buildId
    );
  }

  logFeedbackMessage(buildId);
}

function handleUserInput(
  accountId: number,
  projectName: string,
  currentBuildId: number
): void {
  const onTerminate = async () => {
    logger.log(i18n(`commands.project.subcommands.watch.logs.processExited`));

    if (currentBuildId) {
      try {
        await cancelStagedBuild(accountId, projectName);
        process.exit(EXIT_CODES.SUCCESS);
      } catch (err) {
        if (
          isSpecifiedError(err, {
            subCategory: PROJECT_ERROR_TYPES.BUILD_NOT_IN_PROGRESS,
          })
        ) {
          process.exit(EXIT_CODES.SUCCESS);
        } else {
          logError(err, new ApiErrorContext({ accountId }));
          process.exit(EXIT_CODES.ERROR);
        }
      }
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  };

  handleExit(onTerminate);
  handleKeypress(key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      onTerminate();
    }
  });
}

async function handler(
  args: ArgumentsCamelCase<ProjectWatchArgs>
): Promise<void> {
  const { initialUpload, derivedAccountId } = args;

  trackCommandUsage('project-watch', undefined, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    logger.error(
      i18n(`commands.project.subcommands.watch.errors.projectConfigNotFound`)
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (useV3Api(projectConfig.platformVersion)) {
    logger.error(
      i18n(`commands.project.subcommands.watch.errors.v3ApiError`, {
        command: uiCommandReference('hs project watch'),
        newCommand: uiCommandReference('hs project dev'),
        platformVersion: projectConfig.platformVersion,
        linkToDocs: uiLink(
          'How to develop locally.',
          'https://developers.hubspot.com/docs/guides/crm/ui-extensions/local-development'
        ),
      })
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!projectConfigIsValid(projectConfig, projectDir)) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    const {
      data: { results: builds },
    } = await fetchProjectBuilds(derivedAccountId, projectConfig.name);
    const hasNoBuilds = !builds || !builds.length;

    const startWatching = async () => {
      await createWatcher(
        derivedAccountId,
        projectConfig,
        projectDir,
        handleBuildStatus,
        handleUserInput
      );
    };

    // Upload all files if no build exists for this project yet
    if (initialUpload || hasNoBuilds) {
      const { uploadError } = await handleProjectUpload({
        accountId: derivedAccountId,
        projectConfig,
        projectDir,
        callbackFunc: startWatching,
        isUploadCommand: false,
      });

      if (uploadError) {
        if (
          isSpecifiedError(uploadError, {
            subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
          })
        ) {
          logger.log();
          logger.error(
            i18n(`commands.project.subcommands.watch.errors.projectLockedError`)
          );
          logger.log();
        } else {
          logError(
            uploadError,
            new ApiErrorContext({
              accountId: derivedAccountId,
              request: 'project upload',
            })
          );
        }
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      await startWatching();
    }
  } catch (e) {
    logError(e, new ApiErrorContext({ accountId: derivedAccountId }));
  }
}

function projectWatchBuilder(yargs: Argv): Argv<ProjectWatchArgs> {
  yargs.option('initial-upload', {
    alias: 'i',
    describe: i18n(
      `commands.project.subcommands.watch.options.initialUpload.describe`
    ),
    type: 'boolean',
  });

  yargs.example([
    [
      '$0 project watch',
      i18n(`commands.project.subcommands.watch.examples.default`),
    ],
  ]);

  return yargs as Argv<ProjectWatchArgs>;
}

const builder = makeYargsBuilder<ProjectWatchArgs>(
  projectWatchBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const projectWatchCommand: YargsCommandModule<unknown, ProjectWatchArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectWatchCommand;
