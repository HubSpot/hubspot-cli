const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const chalk = require('chalk');
const findup = require('findup-sync');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  FEEDBACK_INTERVAL,
  ERROR_TYPES,
  POLLING_DELAY,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  PROJECT_CONFIG_FILE,
  PROJECT_TASK_TYPES,
  SPINNER_STATUS,
} = require('@hubspot/cli-lib/lib/constants');
const {
  createProject,
  getBuildStatus,
  getBuildStructure,
  getDeployStatus,
  getDeployStructure,
  fetchProject,
  uploadProject,
} = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const { getCwd, getAbsoluteFilePath } = require('@hubspot/cli-lib/path');
const { downloadGitHubRepoContents } = require('@hubspot/cli-lib/github');
const { promptUser } = require('./prompts/promptUtils');
const { EXIT_CODES } = require('./enums/exitCodes');
const { uiLine, uiLink, uiAccountDescription } = require('../lib/ui');
const { i18n } = require('./lang');
const SpinniesManager = require('./SpinniesManager');
const {
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');

const i18nKey = 'cli.lib.projects';

const writeProjectConfig = (configPath, config) => {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.error(`Could not write project config at ${configPath}`);
  }
};

const getIsInProject = _dir => {
  const configPath = getProjectConfigPath(_dir);
  return !!configPath;
};

const getProjectConfigPath = _dir => {
  const projectDir = _dir ? getAbsoluteFilePath(_dir) : getCwd();

  const configPath = findup(PROJECT_CONFIG_FILE, {
    cwd: projectDir,
    nocase: true,
  });

  return configPath;
};

const getProjectConfig = async _dir => {
  const configPath = await getProjectConfigPath(_dir);
  if (!configPath) {
    return { projectConfig: null, projectDir: null };
  }

  try {
    const config = fs.readFileSync(configPath);
    const projectConfig = JSON.parse(config);
    return {
      projectDir: path.dirname(configPath),
      projectConfig,
    };
  } catch (e) {
    logger.error('Could not read from project config');
  }
};

const createProjectConfig = async (
  projectPath,
  projectName,
  template,
  repoPath
) => {
  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  if (projectConfig) {
    logger.warn(
      projectPath === projectDir
        ? 'A project already exists in that location.'
        : `Found an existing project definition in ${projectDir}.`
    );

    const { shouldContinue } = await promptUser([
      {
        name: 'shouldContinue',
        message: () => {
          return projectPath === projectDir
            ? 'Do you want to overwrite the existing project definition with a new one?'
            : `Continue creating a new project in ${projectPath}?`;
        },
        type: 'confirm',
        default: false,
      },
    ]);

    if (!shouldContinue) {
      return false;
    }
  }

  const projectConfigPath = path.join(projectPath, PROJECT_CONFIG_FILE);

  logger.log(
    `Creating project config in ${
      projectPath ? projectPath : 'the current folder'
    }`
  );

  if (template.name === 'no-template') {
    fs.ensureDirSync(path.join(projectPath, 'src'));

    writeProjectConfig(projectConfigPath, {
      name: projectName,
      srcDir: 'src',
    });
  } else {
    await downloadGitHubRepoContents(repoPath, template.path, projectPath);
    const _config = JSON.parse(fs.readFileSync(projectConfigPath));
    writeProjectConfig(projectConfigPath, {
      ..._config,
      name: projectName,
    });
  }

  return true;
};

const validateProjectConfig = (projectConfig, projectDir) => {
  if (!projectConfig) {
    logger.error(
      `Project config not found. Try running 'hs project create' first.`
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    logger.error(
      'Project config is missing required fields. Try running `hs project create`.'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (!fs.existsSync(path.resolve(projectDir, projectConfig.srcDir))) {
    logger.error(
      `Project source directory '${projectConfig.srcDir}' could not be found in ${projectDir}.`
    );
    process.exit(EXIT_CODES.ERROR);
  }
};

const pollFetchProject = async (accountId, projectName) => {
  // Temporary solution for gating slowness. Retry on 403 statusCode
  return new Promise((resolve, reject) => {
    let pollCount = 0;
    const spinnies = SpinniesManager.init();
    spinnies.add('pollFetchProject', {
      text: 'Fetching project status',
    });
    const pollInterval = setInterval(async () => {
      try {
        const project = await fetchProject(accountId, projectName);
        if (project) {
          spinnies.remove('pollFetchProject');
          clearInterval(pollInterval);
          resolve(project);
        }
      } catch (err) {
        if (
          isSpecifiedError(err, {
            statusCode: 403,
            category: 'GATED',
            subCategory: 'BuildPipelineErrorType.PORTAL_GATED',
          })
        ) {
          pollCount += 1;
        } else if (pollCount >= 15) {
          // Poll up to max 30s
          spinnies.remove('pollFetchProject');
          clearInterval(pollInterval);
          reject(err);
        } else {
          spinnies.remove('pollFetchProject');
          clearInterval(pollInterval);
          reject(err);
        }
      }
    }, POLLING_DELAY);
  });
};

const ensureProjectExists = async (
  accountId,
  projectName,
  {
    forceCreate = false,
    allowCreate = true,
    noLogs = false,
    withPolling = false,
  } = {}
) => {
  const accountIdentifier = uiAccountDescription(accountId);
  try {
    const project = withPolling
      ? await pollFetchProject(accountId, projectName)
      : await fetchProject(accountId, projectName);
    return !!project;
  } catch (err) {
    if (err.statusCode === 404) {
      let shouldCreateProject = forceCreate;

      if (allowCreate && !shouldCreateProject) {
        const promptResult = await promptUser([
          {
            name: 'shouldCreateProject',
            message: i18n(`${i18nKey}.ensureProjectExists.createPrompt`, {
              projectName,
              accountIdentifier,
            }),
            type: 'confirm',
          },
        ]);
        shouldCreateProject = promptResult.shouldCreateProject;
      }

      if (shouldCreateProject) {
        try {
          await createProject(accountId, projectName);
          logger.success(
            i18n(`${i18nKey}.ensureProjectExists.createSuccess`, {
              projectName,
              accountIdentifier,
            })
          );
          return true;
        } catch (err) {
          return logApiErrorInstance(
            err,
            new ApiErrorContext({ accountId, projectName })
          );
        }
      } else {
        if (!noLogs) {
          logger.log(
            i18n(`${i18nKey}.ensureProjectExists.notFound`, {
              projectName,
              accountIdentifier,
            })
          );
        }
        return false;
      }
    }
    logApiErrorInstance(err, new ApiErrorContext({ accountId, projectName }));
    process.exit(EXIT_CODES.ERROR);
  }
};

const getProjectHomeUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/developer-projects/${accountId}`;
};

const getProjectDetailUrl = (projectName, accountId) => {
  if (!projectName) return;
  return `${getProjectHomeUrl(accountId)}/project/${projectName}`;
};

const getProjectBuildDetailUrl = (projectName, buildId, accountId) => {
  if (!projectName || !buildId || !accountId) return;
  return `${getProjectDetailUrl(projectName, accountId)}/build/${buildId}`;
};

const getProjectDeployDetailUrl = (projectName, deployId, accountId) => {
  if (!projectName || !deployId || !accountId) return;
  return `${getProjectDetailUrl(
    projectName,
    accountId
  )}/activity/deploy/${deployId}`;
};

const uploadProjectFiles = async (
  accountId,
  projectName,
  filePath,
  uploadMessage
) => {
  const spinnies = SpinniesManager.init({});
  const accountIdentifier = uiAccountDescription(accountId);

  spinnies.add('upload', {
    text: i18n(`${i18nKey}.uploadProjectFiles.add`, {
      accountIdentifier,
      projectName,
    }),
    succeedColor: 'white',
  });

  let buildId;

  try {
    const upload = await uploadProject(
      accountId,
      projectName,
      filePath,
      uploadMessage
    );

    buildId = upload.buildId;

    spinnies.succeed('upload', {
      text: i18n(`${i18nKey}.uploadProjectFiles.succeed`, {
        accountIdentifier,
        projectName,
      }),
    });

    logger.debug(
      i18n(`${i18nKey}.uploadProjectFiles.buildCreated`, {
        buildId,
        projectName,
      })
    );
  } catch (err) {
    spinnies.fail('upload', {
      text: i18n(`${i18nKey}.uploadProjectFiles.fail`, {
        accountIdentifier,
        projectName,
      }),
    });

    logApiErrorInstance(
      err,
      new ApiErrorContext({
        accountId,
        projectName,
      })
    );
    if (err.error.subCategory === ERROR_TYPES.PROJECT_LOCKED) {
      logger.log(i18n(`${i18nKey}.uploadProjectFiles.projectLockedError`));
    }
    process.exit(EXIT_CODES.ERROR);
  }

  return { buildId };
};

const pollProjectBuildAndDeploy = async (
  accountId,
  projectConfig,
  tempFile,
  buildId,
  silenceLogs = false
) => {
  const {
    autoDeployId,
    isAutoDeployEnabled,
    deployStatusTaskLocator,
    status,
  } = await pollBuildStatus(
    accountId,
    projectConfig.name,
    buildId,
    null,
    silenceLogs
  );
  // autoDeployId of 0 indicates a skipped deploy
  const isDeploying =
    isAutoDeployEnabled && autoDeployId > 0 && deployStatusTaskLocator;

  if (!silenceLogs) {
    uiLine();
  }

  const result = {
    succeeded: true,
    buildId,
    buildSucceeded: true,
    autodeployEnabled: isAutoDeployEnabled,
  };

  if (status === 'FAILURE') {
    result.buildSucceeded = false;
    result.succeeded = false;
    return result;
  } else if (isDeploying) {
    if (!silenceLogs) {
      logger.log(
        i18n(
          `${i18nKey}.pollProjectBuildAndDeploy.buildSucceededAutomaticallyDeploying`,
          {
            accountIdentifier: uiAccountDescription(accountId),
            buildId,
          }
        )
      );
    }
    const { status } = await pollDeployStatus(
      accountId,
      projectConfig.name,
      deployStatusTaskLocator.id,
      buildId,
      silenceLogs
    );
    if (status === 'FAILURE') {
      result.succeeded = false;
    }
  }

  try {
    if (tempFile) {
      tempFile.removeCallback();
      logger.debug(
        i18n(`${i18nKey}.pollProjectBuildAndDeploy.cleanedUpTempFile`, {
          path: tempFile.name,
        })
      );
    }
  } catch (e) {
    logger.error(e);
  }

  return result;
};

const handleProjectUpload = async (
  accountId,
  projectConfig,
  projectDir,
  callbackFunc,
  uploadMessage
) => {
  const srcDir = path.resolve(projectDir, projectConfig.srcDir);

  const filenames = fs.readdirSync(srcDir);
  if (!filenames || filenames.length === 0) {
    logger.log(
      i18n(`${i18nKey}.handleProjectUpload.emptySource`, {
        srcDir: projectConfig.srcDir,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.debug(
    i18n(`${i18nKey}.handleProjectUpload.compressing`, {
      path: tempFile.name,
    })
  );

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  const result = new Promise(resolve =>
    output.on('close', async function() {
      let result = {};

      logger.debug(
        i18n(`${i18nKey}.handleProjectUpload.compressed`, {
          byteCount: archive.pointer(),
        })
      );

      const { buildId } = await uploadProjectFiles(
        accountId,
        projectConfig.name,
        tempFile.name,
        uploadMessage
      );

      if (callbackFunc) {
        result = await callbackFunc(
          accountId,
          projectConfig,
          tempFile,
          buildId
        );
      }
      resolve(result);
    })
  );

  archive.pipe(output);

  archive.directory(srcDir, false, file =>
    shouldIgnoreFile(file.name, true) ? false : file
  );

  archive.finalize();

  return result;
};

const makePollTaskStatusFunc = ({
  statusFn,
  structureFn,
  statusText,
  statusStrings,
  linkToHubSpot,
}) => {
  const isTaskComplete = task => {
    if (
      !task[statusText.SUBTASK_KEY].length ||
      task.status === statusText.STATES.FAILURE
    ) {
      return true;
    } else if (task.status === statusText.STATES.SUCCESS) {
      return task.isAutoDeployEnabled ? !!task.deployStatusTaskLocator : true;
    }
  };

  return async (
    accountId,
    taskName,
    taskId,
    deployedBuildId = null,
    silenceLogs = false
  ) => {
    const displayId = deployedBuildId || taskId;

    if (linkToHubSpot && !silenceLogs) {
      logger.log(
        `\n${linkToHubSpot(accountId, taskName, taskId, deployedBuildId)}\n`
      );
    }

    const spinnies = SpinniesManager.init();

    const overallTaskSpinniesKey = `overallTaskStatus-${statusText.STATUS_TEXT}`;

    spinnies.add(overallTaskSpinniesKey, {
      text: 'Beginning',
      succeedColor: 'white',
      failColor: 'white',
      failPrefix: chalk.bold('!'),
    });

    const [
      initialTaskStatus,
      { topLevelComponentsWithChildren: taskStructure },
    ] = await Promise.all([
      statusFn(accountId, taskName, taskId),
      structureFn(accountId, taskName, taskId),
    ]);

    const tasksById = initialTaskStatus[statusText.SUBTASK_KEY].reduce(
      (acc, task) => {
        const type = task[statusText.TYPE_KEY];
        if (type !== 'APP_ID' && type !== 'SERVERLESS_PKG') {
          acc[task.id] = task;
        }
        return acc;
      },
      {}
    );

    const structuredTasks = Object.keys(taskStructure).map(key => {
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
      : i18n(
          numComponents === 1
            ? `${i18nKey}.makePollTaskStatusFunc.componentCountSingular`
            : `${i18nKey}.makePollTaskStatusFunc.componentCount`,
          { numComponents }
        ) + '\n';

    spinnies.update(overallTaskSpinniesKey, {
      text: `${statusStrings.INITIALIZE(taskName)}\n${componentCountText}`,
    });

    if (!silenceLogs) {
      const addTaskSpinner = (task, indent, newline) => {
        const taskName = task[statusText.SUBTASK_NAME_KEY];
        const taskType = task[statusText.TYPE_KEY];
        const formattedTaskType = PROJECT_TASK_TYPES[taskType]
          ? `[${PROJECT_TASK_TYPES[taskType]}]`
          : '';
        const text = `${statusText.STATUS_TEXT} ${chalk.bold(
          taskName
        )} ${formattedTaskType} ...${newline ? '\n' : ''}`;

        spinnies.add(task.id, {
          text,
          indent,
          succeedColor: 'white',
          failColor: 'white',
        });
      };

      structuredTasks.forEach(task => {
        addTaskSpinner(task, 2, !task.subtasks || task.subtasks.length === 0);
        task.subtasks.forEach((subtask, i) =>
          addTaskSpinner(subtask, 4, i === task.subtasks.length - 1)
        );
      });
    }

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        const taskStatus = await statusFn(accountId, taskName, taskId).catch(
          reject
        );

        const { status, [statusText.SUBTASK_KEY]: subTaskStatus } = taskStatus;

        if (spinnies.hasActiveSpinners()) {
          subTaskStatus.forEach(subTask => {
            const { id, status } = subTask;
            const spinner = spinnies.pick(id);

            if (!spinner || spinner.status !== SPINNER_STATUS.SPINNING) {
              return;
            }

            const topLevelTask = structuredTasks.find(t => t.id == id);

            if (
              status === statusText.STATES.SUCCESS ||
              status === statusText.STATES.FAILURE
            ) {
              const taskStatusText =
                subTask.status === statusText.STATES.SUCCESS
                  ? i18n(`${i18nKey}.makePollTaskStatusFunc.successStatusText`)
                  : i18n(`${i18nKey}.makePollTaskStatusFunc.failedStatusText`);
              const hasNewline =
                spinner.text.includes('\n') || Boolean(topLevelTask);
              const updatedText = `${spinner.text.replace(
                '\n',
                ''
              )} ${taskStatusText}${hasNewline ? '\n' : ''}`;

              status === statusText.STATES.SUCCESS
                ? spinnies.succeed(id, { text: updatedText })
                : spinnies.fail(id, { text: updatedText });

              if (topLevelTask) {
                topLevelTask.subtasks.forEach(currentSubtask =>
                  spinnies.remove(currentSubtask.id)
                );
              }
            }
          });

          if (isTaskComplete(taskStatus)) {
            if (status === statusText.STATES.SUCCESS) {
              spinnies.succeed(overallTaskSpinniesKey, {
                text: statusStrings.SUCCESS(taskName),
              });
            } else if (status === statusText.STATES.FAILURE) {
              spinnies.fail(overallTaskSpinniesKey, {
                text: statusStrings.FAIL(taskName),
              });

              if (!silenceLogs) {
                const failedSubtasks = subTaskStatus.filter(
                  subtask => subtask.status === 'FAILURE'
                );

                uiLine();
                logger.log(
                  `${statusStrings.SUBTASK_FAIL(
                    displayId,
                    failedSubtasks.length === 1
                      ? failedSubtasks[0][statusText.SUBTASK_NAME_KEY]
                      : failedSubtasks.length + ' components'
                  )}\n`
                );
                logger.log('See below for a summary of errors.');
                uiLine();

                failedSubtasks.forEach(subTask => {
                  logger.log(
                    `\n--- ${chalk.bold(
                      subTask[statusText.SUBTASK_NAME_KEY]
                    )} failed with the following error ---`
                  );
                  logger.error(subTask.errorMessage);

                  // Log nested errors
                  if (subTask.standardError && subTask.standardError.errors) {
                    logger.log();
                    subTask.standardError.errors.forEach(error => {
                      logger.log(error.message);
                    });
                  }
                });
              }
            }
            clearInterval(pollInterval);
            resolve(taskStatus);
          }
        }
      }, POLLING_DELAY);
    });
  };
};

const pollBuildStatus = makePollTaskStatusFunc({
  linkToHubSpot: (accountId, taskName, taskId) =>
    uiLink(
      `View build #${taskId} in HubSpot`,
      getProjectBuildDetailUrl(taskName, taskId, accountId)
    ),
  statusFn: getBuildStatus,
  structureFn: getBuildStructure,
  statusText: PROJECT_BUILD_TEXT,
  statusStrings: {
    INITIALIZE: name => `Building ${chalk.bold(name)}`,
    SUCCESS: name => `Built ${chalk.bold(name)}`,
    FAIL: name => `Failed to build ${chalk.bold(name)}`,
    SUBTASK_FAIL: (buildId, name) =>
      `Build #${buildId} failed because there was a problem\nbuilding ${chalk.bold(
        name
      )}`,
  },
});

const pollDeployStatus = makePollTaskStatusFunc({
  linkToHubSpot: (accountId, taskName, taskId, deployedBuildId) =>
    uiLink(
      `View deploy of build #${deployedBuildId} in HubSpot`,
      getProjectDeployDetailUrl(taskName, taskId, accountId)
    ),
  statusFn: getDeployStatus,
  structureFn: getDeployStructure,
  statusText: PROJECT_DEPLOY_TEXT,
  statusStrings: {
    INITIALIZE: name => `Deploying ${chalk.bold(name)}`,
    SUCCESS: name => `Deployed ${chalk.bold(name)}`,
    FAIL: name => `Failed to deploy ${chalk.bold(name)}`,
    SUBTASK_FAIL: (deployedBuildId, name) =>
      `Deploy for build #${deployedBuildId} failed because there was a\nproblem deploying ${chalk.bold(
        name
      )}`,
  },
});

const logFeedbackMessage = buildId => {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackHeader`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackMessage`));
  }
};

const createProjectComponent = async (component, name) => {
  const i18nKey = 'cli.commands.project.subcommands.add';
  let componentName = name;

  const configInfo = await getProjectConfig();

  if (!configInfo.projectDir && !configInfo.projectConfig) {
    logger.error(i18n(`${i18nKey}.error.locationInProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  const componentPath = path.join(
    configInfo.projectDir,
    configInfo.projectConfig.srcDir,
    component.insertPath,
    componentName
  );

  await downloadGitHubRepoContents(
    'HubSpot/hubspot-project-components',
    component.path,
    componentPath
  );
};

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  getIsInProject,
  pollProjectBuildAndDeploy,
  handleProjectUpload,
  createProjectConfig,
  validateProjectConfig,
  getProjectHomeUrl,
  getProjectDetailUrl,
  getProjectBuildDetailUrl,
  pollBuildStatus,
  pollDeployStatus,
  ensureProjectExists,
  logFeedbackMessage,
  createProjectComponent,
};
