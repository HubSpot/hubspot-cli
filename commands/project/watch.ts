import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  cancelStagedBuild,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { isV2Project } from '../../lib/projects/platformVersion.js';
import { commands } from '../../lang/en.js';
import { createWatcher } from '../../lib/projects/watch.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { PROJECT_ERROR_TYPES } from '../../lib/constants.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { logFeedbackMessage } from '../../lib/projects/ui.js';
import { handleProjectUpload } from '../../lib/projects/upload.js';
import {
  pollBuildStatus,
  pollDeployStatus,
} from '../../lib/projects/pollProjectBuildAndDeploy.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { handleKeypress, handleExit } from '../../lib/process.js';
import {
  CommonArgs,
  AccountArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
  ExitFunction,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiDeprecatedTag } from '../../lib/ui/index.js';

const command = 'watch';
const describe = uiDeprecatedTag(commands.project.watch.describe, false);

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
  currentBuildId: number,
  exit: ExitFunction
): void {
  const onTerminate = async () => {
    uiLogger.log(commands.project.watch.logs.processExited);

    if (currentBuildId) {
      try {
        await cancelStagedBuild(accountId, projectName);
        return exit(EXIT_CODES.SUCCESS);
      } catch (err) {
        if (
          isSpecifiedError(err, {
            subCategory: PROJECT_ERROR_TYPES.BUILD_NOT_IN_PROGRESS,
          })
        ) {
          return exit(EXIT_CODES.SUCCESS);
        } else {
          logError(err, new ApiErrorContext({ accountId }));
          return exit(EXIT_CODES.ERROR);
        }
      }
    } else {
      return exit(EXIT_CODES.SUCCESS);
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
  const { initialUpload, derivedAccountId, exit } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.watch.errors.projectConfigNotFound);
    return exit(EXIT_CODES.ERROR);
  }

  if (isV2Project(projectConfig.platformVersion)) {
    uiLogger.error(
      commands.project.watch.errors.v2ApiError(projectConfig.platformVersion)
    );
    return exit(EXIT_CODES.ERROR);
  }

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  try {
    const {
      data: { results: builds },
    } = await fetchProjectBuilds(derivedAccountId, projectConfig.name);
    const hasNoBuilds = !builds || !builds.length;

    const handleWatchTermination = (error?: unknown) => {
      if (error) {
        logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
        return exit(EXIT_CODES.ERROR);
      } else {
        return exit(EXIT_CODES.SUCCESS);
      }
    };

    const startWatching = async () => {
      await createWatcher(
        derivedAccountId,
        projectConfig,
        projectDir,
        handleBuildStatus,
        (accountId, projectName, buildId) =>
          handleUserInput(accountId, projectName, buildId, exit),
        handleWatchTermination
      );
    };

    // Upload all files if no build exists for this project yet
    if (initialUpload || hasNoBuilds) {
      const { uploadError, projectNotFound } = await handleProjectUpload({
        accountId: derivedAccountId,
        projectConfig,
        projectDir,
        callbackFunc: startWatching,
        isUploadCommand: false,
      });

      if (projectNotFound) {
        return exit(EXIT_CODES.ERROR);
      }

      if (uploadError) {
        if (
          isSpecifiedError(uploadError, {
            subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
          })
        ) {
          uiLogger.log('');
          uiLogger.error(commands.project.watch.errors.projectLockedError);
          uiLogger.log('');
        } else {
          logError(
            uploadError,
            new ApiErrorContext({
              accountId: derivedAccountId,
              request: 'project upload',
            })
          );
        }
        return exit(EXIT_CODES.ERROR);
      }
    } else {
      await startWatching();
    }
  } catch (e) {
    logError(e, new ApiErrorContext({ accountId: derivedAccountId }));
    return exit(EXIT_CODES.ERROR);
  }
}

function projectWatchBuilder(yargs: Argv): Argv<ProjectWatchArgs> {
  yargs.option('initial-upload', {
    alias: 'i',
    describe: commands.project.watch.options.initialUpload.describe,
    type: 'boolean',
  });

  yargs.example([
    ['$0 project watch', commands.project.watch.examples.default],
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
  handler: makeYargsHandlerWithUsageTracking('project-watch', handler),
  builder,
};

export default projectWatchCommand;
