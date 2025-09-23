import { ArgumentsCamelCase, Argv } from 'yargs';
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
import { trackCommandUsage } from '../../lib/usageTracking.js';
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
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'watch';
const describe = commands.project.watch.describe;

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
    uiLogger.log(commands.project.watch.logs.processExited);

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

  validateProjectConfig(projectConfig, projectDir);

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.watch.errors.projectConfigNotFound);
    return process.exit(EXIT_CODES.ERROR);
  }

  if (isV2Project(projectConfig.platformVersion)) {
    uiLogger.error(projectConfig.platformVersion);
    return process.exit(EXIT_CODES.ERROR);
  }

  validateProjectConfig(projectConfig, projectDir);

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
  handler,
  builder,
};

export default projectWatchCommand;
