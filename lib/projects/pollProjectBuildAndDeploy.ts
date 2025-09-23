import chalk from 'chalk';
import { FileResult } from 'tmp';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { ComponentStructureResponse } from '@hubspot/local-dev-lib/types/ComponentStructure';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { Deploy } from '@hubspot/local-dev-lib/types/Deploy';
import {
  getBuildStatus,
  getBuildStructure,
  getDeployStatus,
  getDeployStructure,
  fetchBuildWarnLogs,
  fetchDeployWarnLogs,
} from '@hubspot/local-dev-lib/api/projects';
import { WarnLogsResponse } from '@hubspot/local-dev-lib/types/Project';

import {
  DEFAULT_POLLING_DELAY,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  PROJECT_TASK_TYPES,
  PROJECT_ERROR_TYPES,
} from '../constants.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { uiLine, uiLink, uiAccountDescription } from '../ui/index.js';
import {
  getProjectBuildDetailUrl,
  getProjectDeployDetailUrl,
  getProjectActivityUrl,
} from './urls.js';
import {
  ProjectConfig,
  ProjectTask,
  ProjectSubtask,
  ProjectPollStatusFunctionText,
  ProjectPollResult,
} from '../../types/Projects.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import { AppFunctionsPackageKey } from '@hubspot/project-parsing-lib/src/lib/constants.js';
import { mapToInternalType } from '@hubspot/project-parsing-lib';

const SPINNER_STATUS = {
  SPINNING: 'spinning',
};

function getSubtasks(task: ProjectTask): ProjectSubtask[] {
  if ('subbuildStatuses' in task) {
    return task.subbuildStatuses;
  }
  return task.subdeployStatuses;
}

function getSubtaskName(task: ProjectSubtask): string {
  if ('buildName' in task) {
    return task.buildName;
  }
  return task.deployName;
}

function getSubtaskType(task: ProjectSubtask): string {
  if ('buildType' in task) {
    return task.buildType;
  }
  return task.deployType;
}

type PollTaskStatusFunctionConfig<T extends ProjectTask> = {
  statusFn: (
    accountId: number,
    projectName: string,
    taskId: number
  ) => HubSpotPromise<T>;
  structureFn: (
    accountId: number,
    projectName: string,
    taskId: number
  ) => HubSpotPromise<ComponentStructureResponse>;
  statusText: ProjectPollStatusFunctionText;
  statusStrings: PollTaskStatusStrings;
  linkToHubSpot: (
    accountId: number,
    taskName: string,
    taskId: number,
    deployedBuildId: number | null
  ) => void;
};

type PollTaskStatus = 'INITIALIZE' | 'SUCCESS' | 'FAIL' | 'SUBTASK_FAIL';

type PollTaskStatusStringFunction = (name: string, taskId: number) => string;

type PollTaskStatusStrings = {
  [k in PollTaskStatus]: PollTaskStatusStringFunction;
};

type PollTaskStatusFunction<T extends ProjectTask> = (
  accountId: number,
  taskName: string,
  taskId: number,
  deployedBuildId: number | null,
  silenceLogs?: boolean
) => Promise<T>;

function handleTaskStatusError(
  statusText: ProjectPollStatusFunctionText
): never {
  uiLogger.error(
    lib.projectBuildAndDeploy.makePollTaskStatusFunc.errorFetchingTaskStatus(
      statusText.TYPE_KEY === PROJECT_BUILD_TEXT.TYPE_KEY ? 'build' : 'deploy'
    )
  );
  process.exit(EXIT_CODES.ERROR);
}

function makePollTaskStatusFunc<T extends ProjectTask>({
  statusFn,
  structureFn,
  statusText,
  statusStrings,
  linkToHubSpot,
}: PollTaskStatusFunctionConfig<T>): PollTaskStatusFunction<T> {
  return async function (
    accountId: number,
    taskName: string,
    taskId: number,
    deployedBuildId: number | null,
    silenceLogs: boolean = false
  ) {
    const displayId = deployedBuildId || taskId;

    if (linkToHubSpot && !silenceLogs) {
      uiLogger.log(
        `\n${linkToHubSpot(accountId, taskName, taskId, deployedBuildId)}\n`
      );
    }

    SpinniesManager.init();

    const overallTaskSpinniesKey = `overallTaskStatus-${statusText.STATUS_TEXT}`;

    SpinniesManager.add(overallTaskSpinniesKey, {
      text: 'Beginning',
      succeedColor: 'white',
      failColor: 'white',
      failPrefix: chalk.bold('!'),
    });

    const [
      { data: initialTaskStatus },
      {
        data: { topLevelComponentsWithChildren: taskStructure },
      },
    ] = await Promise.all([
      statusFn(accountId, taskName, taskId),
      structureFn(accountId, taskName, taskId),
    ]);

    const subtasks = getSubtasks(initialTaskStatus);

    const hiddenComponentBuildIds: string[] = [];

    const tasksById = subtasks
      .filter(subtask => {
        // TODO: Remove this filtering logic when visible=false for SERVERLESS_PACKAGE
        const shouldBeVisible =
          getSubtaskType(subtask) !== mapToInternalType(AppFunctionsPackageKey);
        if (!shouldBeVisible) {
          hiddenComponentBuildIds.push(subtask.id);
        }
        return shouldBeVisible;
      })
      .reduce((acc: { [key: string]: ProjectSubtask }, subtask) => {
        const { id, visible } = subtask;
        if (visible) {
          acc[id] = subtask;
        }
        return acc;
      }, {});

    const structuredTasks = Object.keys(taskStructure)
      // TODO: Remove this filtering logic when visible=false for SERVERLESS_PACKAGE
      .filter(buildId => !hiddenComponentBuildIds.includes(buildId))
      .map(key => {
        return {
          ...tasksById[key],
          subtasks: taskStructure[key]
            .filter(taskId => Boolean(tasksById[taskId]))
            .map(taskId => tasksById[taskId]),
        };
      });

    const numComponents = structuredTasks.length;
    const componentCountText = silenceLogs
      ? ''
      : numComponents === 1
        ? lib.projectBuildAndDeploy.makePollTaskStatusFunc
            .componentCountSingular
        : lib.projectBuildAndDeploy.makePollTaskStatusFunc.componentCount(
            numComponents
          );

    SpinniesManager.update(overallTaskSpinniesKey, {
      text: `${statusStrings.INITIALIZE(
        taskName,
        displayId
      )}\n${componentCountText}`,
    });

    if (!silenceLogs) {
      function addTaskSpinner(
        subtask: ProjectSubtask,
        indent: number,
        newline: boolean
      ): void {
        const taskName = getSubtaskName(subtask);
        const taskType = getSubtaskType(subtask);
        const formattedTaskType = PROJECT_TASK_TYPES[taskType]
          ? `[${PROJECT_TASK_TYPES[taskType]}]`
          : '';
        const text = `${indent <= 2 ? statusText.STATUS_TEXT : ''} ${chalk.bold(
          taskName
        )} ${formattedTaskType} ...${newline ? '\n' : ''}`;

        SpinniesManager.add(subtask.id, {
          text,
          indent,
          succeedColor: 'white',
          failColor: 'white',
        });
      }

      structuredTasks.forEach(task => {
        addTaskSpinner(task, 2, !task.subtasks || task.subtasks.length === 0);
        task.subtasks.forEach((subtask, i) =>
          addTaskSpinner(subtask, 4, i === task.subtasks.length - 1)
        );
      });
    }

    return new Promise<T>(resolve => {
      const pollInterval = setInterval(async () => {
        let taskStatus: T;
        try {
          const { data } = await statusFn(accountId, taskName, taskId);
          taskStatus = data;
        } catch (e) {
          uiLogger.debug(e);
          logError(
            e,
            new ApiErrorContext({
              accountId,
              projectName: taskName,
            })
          );

          handleTaskStatusError(statusText);
        }

        const subtasks = getSubtasks(taskStatus);

        if (!taskStatus || !taskStatus.status || !subtasks) {
          handleTaskStatusError(statusText);
        }

        const { status } = taskStatus;

        if (SpinniesManager.hasActiveSpinners()) {
          subtasks.forEach(subtask => {
            const { id, status } = subtask;
            const spinner = SpinniesManager.pick(id);

            if (!spinner || spinner.status !== SPINNER_STATUS.SPINNING) {
              return;
            }

            const topLevelTask = structuredTasks.find(t => t.id == id);

            if (
              status === statusText.STATES.SUCCESS ||
              status === statusText.STATES.FAILURE
            ) {
              const taskStatusText =
                subtask.status === statusText.STATES.SUCCESS
                  ? lib.projectBuildAndDeploy.makePollTaskStatusFunc
                      .successStatusText
                  : lib.projectBuildAndDeploy.makePollTaskStatusFunc
                      .failedStatusText;
              const hasNewline =
                spinner?.text?.includes('\n') || Boolean(topLevelTask);
              const updatedText = `${spinner?.text?.replace(
                '\n',
                ''
              )} ${taskStatusText}${hasNewline ? '\n' : ''}`;

              if (status === statusText.STATES.SUCCESS) {
                SpinniesManager.succeed(id, { text: updatedText });
              } else {
                SpinniesManager.fail(id, { text: updatedText });
              }

              if (topLevelTask) {
                topLevelTask.subtasks.forEach(currentSubtask =>
                  SpinniesManager.remove(currentSubtask.id)
                );
              }
            }
          });

          if (status === statusText.STATES.SUCCESS) {
            SpinniesManager.succeed(overallTaskSpinniesKey, {
              text: statusStrings.SUCCESS(taskName, displayId),
            });
            clearInterval(pollInterval);
            resolve(taskStatus);
          } else if (status === statusText.STATES.FAILURE) {
            SpinniesManager.fail(overallTaskSpinniesKey, {
              text: statusStrings.FAIL(taskName, displayId),
            });

            if (!silenceLogs) {
              const failedSubtasks = subtasks.filter(
                subtask => subtask.status === 'FAILURE'
              );

              uiLine();
              uiLogger.log(
                `${statusStrings.SUBTASK_FAIL(
                  failedSubtasks.length === 1
                    ? getSubtaskName(failedSubtasks[0])
                    : failedSubtasks.length + ' components',
                  displayId
                )}\n`
              );
              uiLogger.log(
                lib.projectBuildAndDeploy.makePollTaskStatusFunc.errorSummary
              );
              uiLine();

              const displayErrors = failedSubtasks.filter(
                subtask =>
                  subtask?.standardError?.subCategory !==
                    PROJECT_ERROR_TYPES.SUBBUILD_FAILED &&
                  subtask?.standardError?.subCategory !==
                    PROJECT_ERROR_TYPES.SUBDEPLOY_FAILED
              );

              displayErrors.forEach(subTask => {
                uiLogger.log(
                  `\n--- ${chalk.bold(
                    getSubtaskName(subTask)
                  )} failed with the following error ---`
                );
                uiLogger.error(subTask.errorMessage);

                // Log nested errors
                if (subTask.standardError && subTask.standardError.errors) {
                  uiLogger.log('');
                  subTask.standardError.errors.forEach(error => {
                    uiLogger.log(error.message);
                  });
                }
              });
            }
            clearInterval(pollInterval);
            resolve(taskStatus);
          } else if (!subtasks.length) {
            clearInterval(pollInterval);
            resolve(taskStatus);
          }
        }
      }, DEFAULT_POLLING_DELAY);
    });
  };
}

function pollBuildAutodeployStatus(
  accountId: number,
  taskName: string,
  buildId: number
): Promise<Build> {
  return new Promise((resolve, reject) => {
    let maxIntervals = (15 * 1000) / DEFAULT_POLLING_DELAY; // Num of intervals in ~15s

    const pollInterval = setInterval(async () => {
      let build: Build;
      try {
        const response = await getBuildStatus(accountId, taskName, buildId);
        build = response.data;
      } catch (e) {
        uiLogger.debug(e);
        return reject(
          new Error(
            lib.projectBuildAndDeploy.pollBuildAutodeployStatusError(buildId)
          )
        );
      }

      if (!build || !build.status) {
        return reject(
          new Error(
            lib.projectBuildAndDeploy.pollBuildAutodeployStatusError(buildId)
          )
        );
      }

      if (build.deployStatusTaskLocator || maxIntervals <= 0) {
        clearInterval(pollInterval);
        resolve(build);
      } else {
        maxIntervals -= 1;
      }
    }, DEFAULT_POLLING_DELAY);
  });
}

export const pollBuildStatus = makePollTaskStatusFunc<Build>({
  linkToHubSpot: (accountId, taskName, taskId) =>
    uiLink(
      `View build #${taskId} in HubSpot`,
      getProjectBuildDetailUrl(taskName, taskId, accountId)
    ),
  statusFn: getBuildStatus,
  structureFn: getBuildStructure,
  statusText: PROJECT_BUILD_TEXT,
  statusStrings: {
    INITIALIZE: (name, buildId) => `Building ${chalk.bold(name)} #${buildId}`,
    SUCCESS: (name, buildId) => `Built ${chalk.bold(name)} #${buildId}`,
    FAIL: (name, buildId) => `Failed to build ${chalk.bold(name)} #${buildId}`,
    SUBTASK_FAIL: (buildId, name) =>
      `Build #${buildId} failed because there was a problem\nbuilding ${chalk.bold(
        name
      )}`,
  },
});

export const pollDeployStatus = makePollTaskStatusFunc<Deploy>({
  linkToHubSpot: (accountId, taskName, taskId, deployedBuildId) =>
    uiLink(
      `View deploy of build #${deployedBuildId} in HubSpot`,
      getProjectDeployDetailUrl(taskName, taskId, accountId)
    ),
  statusFn: getDeployStatus,
  structureFn: getDeployStructure,
  statusText: PROJECT_DEPLOY_TEXT,
  statusStrings: {
    INITIALIZE: (name, buildId) =>
      `Deploying build #${buildId} in ${chalk.bold(name)}`,
    SUCCESS: (name, buildId) =>
      `Deployed build #${buildId} in ${chalk.bold(name)}`,
    FAIL: (name, buildId) =>
      `Failed to deploy build #${buildId} in ${chalk.bold(name)}`,
    SUBTASK_FAIL: (deployedBuildId, name) =>
      `Deploy for build #${deployedBuildId} failed because there was a\nproblem deploying ${chalk.bold(
        name
      )}`,
  },
});

export async function displayWarnLogs(
  accountId: number,
  projectName: string,
  taskId: number,
  isDeploy = false
): Promise<void> {
  let result: WarnLogsResponse | undefined;

  if (isDeploy) {
    try {
      const { data } = await fetchDeployWarnLogs(
        accountId,
        projectName,
        taskId
      );
      result = data;
    } catch (e) {
      logError(e);
    }
  } else {
    try {
      const { data } = await fetchBuildWarnLogs(accountId, projectName, taskId);
      result = data;
    } catch (e) {
      logError(e);
    }
  }

  if (result && result.logs) {
    const dedupedLogs = result.logs.reduce(
      (acc, log) => acc.add(log.message),
      new Set<string>()
    );

    Array.from(dedupedLogs).forEach((log, i) => {
      uiLogger.warn(log);
      if (i < dedupedLogs.size - 1) {
        uiLogger.log('');
      }
    });
  }
}

export async function pollProjectBuildAndDeploy(
  accountId: number,
  projectConfig: ProjectConfig,
  tempFile: FileResult,
  buildId: number,
  silenceLogs = false
): Promise<ProjectPollResult> {
  let buildStatus = await pollBuildStatus(
    accountId,
    projectConfig.name,
    buildId,
    null,
    silenceLogs
  );

  if (!silenceLogs) {
    uiLine();
  }

  const result: ProjectPollResult = {
    succeeded: true,
    buildId,
    buildResult: buildStatus,
    deployResult: null,
  };

  if (buildStatus.status === 'FAILURE') {
    result.succeeded = false;
    return result;
  } else if (buildStatus.isAutoDeployEnabled) {
    if (!silenceLogs) {
      uiLogger.log(
        lib.projectBuildAndDeploy.pollProjectBuildAndDeploy.buildSucceededAutomaticallyDeploying(
          buildId,
          uiAccountDescription(accountId)
        )
      );

      await displayWarnLogs(accountId, projectConfig.name, buildId);
    }

    // autoDeployId of 0 indicates a skipped deploy
    const getIsDeploying = () =>
      buildStatus.autoDeployId > 0 && buildStatus.deployStatusTaskLocator;

    // Sometimes the deploys do not immediately initiate, give them a chance to kick off
    if (!getIsDeploying()) {
      buildStatus = await pollBuildAutodeployStatus(
        accountId,
        projectConfig.name,
        buildId
      );
    }

    if (getIsDeploying()) {
      const deployStatus = await pollDeployStatus(
        accountId,
        projectConfig.name,
        Number(buildStatus.deployStatusTaskLocator.id),
        buildId,
        silenceLogs
      );
      result.deployResult = deployStatus;

      if (deployStatus.status === 'FAILURE') {
        result.succeeded = false;
      }
    } else if (!silenceLogs) {
      uiLogger.log(
        lib.projectBuildAndDeploy.pollProjectBuildAndDeploy.unableToFindAutodeployStatus(
          buildId,
          uiLink(
            lib.projectBuildAndDeploy.pollProjectBuildAndDeploy.viewDeploys,
            getProjectActivityUrl(projectConfig.name, accountId)
          )
        )
      );
    }
  }

  try {
    if (tempFile) {
      tempFile.removeCallback();
      uiLogger.debug(
        lib.projectBuildAndDeploy.pollProjectBuildAndDeploy.cleanedUpTempFile(
          tempFile.name
        )
      );
    }
  } catch (e) {
    logError(e);
  }

  if (result && result.deployResult) {
    await displayWarnLogs(
      accountId,
      projectConfig.name,
      result.deployResult.deployId,
      true
    );
  }
  return result;
}
