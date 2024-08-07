const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const chalk = require('chalk');
const findup = require('findup-sync');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getEnv } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  FEEDBACK_INTERVAL,
  POLLING_DELAY,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  PROJECT_CONFIG_FILE,
  PROJECT_TASK_TYPES,
  PROJECT_ERROR_TYPES,
} = require('./constants');
const {
  createProject,
  getBuildStatus,
  getBuildStructure,
  getDeployStatus,
  getDeployStructure,
  fetchProject,
  uploadProject,
  fetchBuildWarnLogs,
  fetchDeployWarnLogs,
} = require('@hubspot/local-dev-lib/api/projects');
const {
  isSpecifiedError,
  isSpecifiedHubSpotAuthError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { shouldIgnoreFile } = require('@hubspot/local-dev-lib/ignoreRules');
const { getCwd, getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const { downloadGithubRepoContents } = require('@hubspot/local-dev-lib/github');
const { promptUser } = require('./prompts/promptUtils');
const { EXIT_CODES } = require('./enums/exitCodes');
const { uiLine, uiLink, uiAccountDescription } = require('../lib/ui');
const { i18n } = require('./lang');
const SpinniesManager = require('./ui/SpinniesManager');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('./errorHandlers/apiErrors');
const { HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH } = require('./constants');

const i18nKey = 'lib.projects';

const SPINNER_STATUS = {
  SPINNING: 'spinning',
};

const writeProjectConfig = (configPath, config) => {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.debug(e);
    return false;
  }
  return true;
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
  templateSource,
  githubRef
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

  const hasCustomTemplateSource = Boolean(templateSource);

  await downloadGithubRepoContents(
    templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    template.path,
    projectPath,
    hasCustomTemplateSource ? undefined : githubRef
  );
  const _config = JSON.parse(fs.readFileSync(projectConfigPath));
  writeProjectConfig(projectConfigPath, {
    ..._config,
    name: projectName,
  });

  if (template.name === 'no-template') {
    fs.ensureDirSync(path.join(projectPath, 'src'));
  }

  return true;
};

const validateProjectConfig = (projectConfig, projectDir) => {
  if (!projectConfig) {
    logger.error(
      `Project config not found. Try running 'hs project create' first.`
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    logger.error(
      'Project config is missing required fields. Try running `hs project create`.'
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  const resolvedPath = path.resolve(projectDir, projectConfig.srcDir);
  if (!resolvedPath.startsWith(projectDir)) {
    const projectConfigFile = path.relative(
      '.',
      path.join(projectDir, PROJECT_CONFIG_FILE)
    );
    logger.error(
      i18n(`${i18nKey}.config.srcOutsideProjectDir`, {
        srcDir: projectConfig.srcDir,
        projectConfig: projectConfigFile,
      })
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!fs.existsSync(resolvedPath)) {
    logger.error(
      `Project source directory '${projectConfig.srcDir}' could not be found in ${projectDir}.`
    );
    return process.exit(EXIT_CODES.ERROR);
  }
};

const pollFetchProject = async (accountId, projectName) => {
  // Temporary solution for gating slowness. Retry on 403 statusCode
  return new Promise((resolve, reject) => {
    let pollCount = 0;
    SpinniesManager.init();
    SpinniesManager.add('pollFetchProject', {
      text: i18n(`${i18nKey}.pollFetchProject.checkingProject`, {
        accountIdentifier: uiAccountDescription(accountId),
      }),
    });
    const pollInterval = setInterval(async () => {
      try {
        const project = await fetchProject(accountId, projectName);
        if (project) {
          SpinniesManager.remove('pollFetchProject');
          clearInterval(pollInterval);
          resolve(project);
        }
      } catch (err) {
        if (
          isSpecifiedError(err, {
            statusCode: 403,
            category: 'GATED',
            subCategory: 'BuildPipelineErrorType.PORTAL_GATED',
          }) &&
          pollCount < 15
        ) {
          pollCount += 1;
        } else {
          SpinniesManager.remove('pollFetchProject');
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
    uploadCommand = false,
  } = {}
) => {
  const accountIdentifier = uiAccountDescription(accountId);
  try {
    const project = withPolling
      ? await pollFetchProject(accountId, projectName)
      : await fetchProject(accountId, projectName);
    return { projectExists: !!project, project };
  } catch (err) {
    if (isSpecifiedError(err, { statusCode: 404 })) {
      let shouldCreateProject = forceCreate;
      if (allowCreate && !shouldCreateProject) {
        const promptKey = uploadCommand ? 'createPromptUpload' : 'createPrompt';
        const promptResult = await promptUser([
          {
            name: 'shouldCreateProject',
            message: i18n(`${i18nKey}.ensureProjectExists.${promptKey}`, {
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
          const project = await createProject(accountId, projectName);
          logger.success(
            i18n(`${i18nKey}.ensureProjectExists.createSuccess`, {
              projectName,
              accountIdentifier,
            })
          );
          return { projectExists: true, project };
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
        return { projectExists: false };
      }
    }
    if (
      isSpecifiedHubSpotAuthError(err, {
        statusCode: 401,
      })
    ) {
      logger.error(err.message);
      process.exit(EXIT_CODES.ERROR);
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
  uploadMessage,
  platformVersion
) => {
  SpinniesManager.init({});
  const accountIdentifier = uiAccountDescription(accountId);

  SpinniesManager.add('upload', {
    text: i18n(`${i18nKey}.uploadProjectFiles.add`, {
      accountIdentifier,
      projectName,
    }),
    succeedColor: 'white',
  });

  let buildId;
  let error;

  try {
    const upload = await uploadProject(
      accountId,
      projectName,
      filePath,
      uploadMessage,
      platformVersion
    );

    buildId = upload.buildId;

    SpinniesManager.succeed('upload', {
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
    SpinniesManager.fail('upload', {
      text: i18n(`${i18nKey}.uploadProjectFiles.fail`, {
        accountIdentifier,
        projectName,
      }),
    });

    error = err;
  }

  return { buildId, error };
};

const pollProjectBuildAndDeploy = async (
  accountId,
  projectConfig,
  tempFile,
  buildId,
  silenceLogs = false
) => {
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

  const result = {
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
      logger.log(
        i18n(
          `${i18nKey}.pollProjectBuildAndDeploy.buildSucceededAutomaticallyDeploying`,
          {
            accountIdentifier: uiAccountDescription(accountId),
            buildId,
          }
        )
      );

      displayWarnLogs(accountId, projectConfig.name, buildId);
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
        buildStatus.deployStatusTaskLocator.id,
        buildId,
        silenceLogs
      );
      result.deployResult = deployStatus;

      if (deployStatus.status === 'FAILURE') {
        result.succeeded = false;
      }
    } else if (!silenceLogs) {
      logger.log(
        i18n(
          `${i18nKey}.pollProjectBuildAndDeploy.unableToFindAutodeployStatus`,
          { buildId }
        )
      );
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

  if (result && result.deployResult) {
    displayWarnLogs(
      accountId,
      projectConfig.name,
      result.deployResult.deployId,
      true
    );
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
      let uploadResult = {};

      logger.debug(
        i18n(`${i18nKey}.handleProjectUpload.compressed`, {
          byteCount: archive.pointer(),
        })
      );

      const { buildId, error } = await uploadProjectFiles(
        accountId,
        projectConfig.name,
        tempFile.name,
        uploadMessage,
        projectConfig.platformVersion
      );

      if (error) {
        uploadResult.uploadError = error;
      } else if (callbackFunc) {
        uploadResult = await callbackFunc(
          accountId,
          projectConfig,
          tempFile,
          buildId
        );
      }
      resolve(uploadResult);
    })
  );

  archive.pipe(output);

  let loggedIgnoredNodeModule = false;

  archive.directory(srcDir, false, file => {
    const ignored = shouldIgnoreFile(file.name, true);
    if (ignored) {
      const isNodeModule = file.name.includes('node_modules');

      if (!isNodeModule || !loggedIgnoredNodeModule) {
        logger.debug(
          i18n(`${i18nKey}.handleProjectUpload.fileFiltered`, {
            filename: file.name,
          })
        );
      }

      if (isNodeModule && !loggedIgnoredNodeModule) {
        loggedIgnoredNodeModule = true;
      }
    }
    return ignored ? false : file;
  });

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

    SpinniesManager.init();

    const overallTaskSpinniesKey = `overallTaskStatus-${statusText.STATUS_TEXT}`;

    SpinniesManager.add(overallTaskSpinniesKey, {
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
        const { id, visible } = task;
        if (visible) {
          acc[id] = task;
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

    SpinniesManager.update(overallTaskSpinniesKey, {
      text: `${statusStrings.INITIALIZE(
        taskName,
        displayId
      )}\n${componentCountText}`,
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

        SpinniesManager.add(task.id, {
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
        let taskStatus;
        try {
          taskStatus = await statusFn(accountId, taskName, taskId);
        } catch (e) {
          logger.debug(e);
          return reject(
            new Error(
              i18n(
                `${i18nKey}.makePollTaskStatusFunc.errorFetchingTaskStatus`,
                {
                  taskType:
                    statusText.TYPE_KEY === PROJECT_BUILD_TEXT.TYPE_KEY
                      ? 'build'
                      : 'deploy',
                }
              )
            )
          );
        }

        if (
          !taskStatus ||
          !taskStatus.status ||
          !taskStatus[statusText.SUBTASK_KEY]
        ) {
          return reject(
            new Error(
              i18n(
                `${i18nKey}.makePollTaskStatusFunc.errorFetchingTaskStatus`,
                {
                  taskType:
                    statusText.TYPE_KEY === PROJECT_BUILD_TEXT.TYPE_KEY
                      ? 'build'
                      : 'deploy',
                }
              )
            )
          );
        }

        const { status, [statusText.SUBTASK_KEY]: subTaskStatus } = taskStatus;

        if (SpinniesManager.hasActiveSpinners()) {
          subTaskStatus.forEach(subTask => {
            const { id, status } = subTask;
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
                ? SpinniesManager.succeed(id, { text: updatedText })
                : SpinniesManager.fail(id, { text: updatedText });

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

              const displayErrors = failedSubtasks.filter(
                subtask =>
                  subtask.standardError.subCategory !==
                    PROJECT_ERROR_TYPES.SUBBUILD_FAILED &&
                  subtask.standardError.subCategory !==
                    PROJECT_ERROR_TYPES.SUBDEPLOY_FAILED
              );

              displayErrors.forEach(subTask => {
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
            clearInterval(pollInterval);
            resolve(taskStatus);
          } else if (!subTaskStatus.length) {
            clearInterval(pollInterval);
            resolve(taskStatus);
          }
        }
      }, POLLING_DELAY);
    });
  };
};

const pollBuildAutodeployStatus = (accountId, taskName, buildId) => {
  return new Promise((resolve, reject) => {
    let maxIntervals = (30 * 1000) / POLLING_DELAY; // Num of intervals in ~30s

    const pollInterval = setInterval(async () => {
      let taskStatus;
      try {
        taskStatus = await getBuildStatus(accountId, taskName, buildId);
      } catch (e) {
        logger.debug(e);
        return reject(
          new Error(
            i18n(`${i18nKey}.pollBuildAutodeployStatusError`, { buildId })
          )
        );
      }

      if (!taskStatus || !taskStatus.status) {
        return reject(
          new Error(
            i18n(`${i18nKey}.pollBuildAutodeployStatusError`, { buildId })
          )
        );
      }

      if (taskStatus.deployStatusTaskLocator || maxIntervals <= 0) {
        clearInterval(pollInterval);
        resolve(taskStatus);
      } else {
        maxIntervals -= 1;
      }
    }, POLLING_DELAY);
  });
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
    INITIALIZE: (name, buildId) => `Building ${chalk.bold(name)} #${buildId}`,
    SUCCESS: (name, buildId) => `Built ${chalk.bold(name)} #${buildId}`,
    FAIL: (name, buildId) => `Failed to build ${chalk.bold(name)} #${buildId}`,
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

const logFeedbackMessage = buildId => {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackHeader`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackMessage`));
  }
};

const createProjectComponent = async (
  component,
  name,
  projectComponentsVersion
) => {
  const i18nKey = 'commands.project.subcommands.add';
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

  await downloadGithubRepoContents(
    HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    component.path,
    componentPath,
    projectComponentsVersion
  );
};

const displayWarnLogs = async (
  accountId,
  projectName,
  taskId,
  isDeploy = false
) => {
  let result;

  if (isDeploy) {
    try {
      result = await fetchDeployWarnLogs(accountId, projectName, taskId);
    } catch (e) {
      logApiErrorInstance(e);
    }
  } else {
    try {
      result = await fetchBuildWarnLogs(accountId, projectName, taskId);
    } catch (e) {
      logApiErrorInstance(e);
    }
  }

  if (result && result.logs.length) {
    result.logs.forEach(log => {
      logger.warn(log.message);
      logger.log('');
    });
  }
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
  displayWarnLogs,
};
