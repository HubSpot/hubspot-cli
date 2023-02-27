const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const chalk = require('chalk');
const findup = require('findup-sync');
const Spinnies = require('spinnies');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { cloneGitHubRepo } = require('@hubspot/cli-lib/github');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  FEEDBACK_INTERVAL,
  ERROR_TYPES,
  POLLING_DELAY,
  PROJECT_TEMPLATES,
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
const { promptUser } = require('./prompts/promptUtils');
const { EXIT_CODES } = require('./enums/exitCodes');
const { uiLine, uiLink, uiAccountDescription } = require('../lib/ui');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

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

const createProjectConfig = async (projectPath, projectName, template) => {
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

  if (template === 'no-template') {
    fs.ensureDirSync(path.join(projectPath, 'src'));

    writeProjectConfig(projectConfigPath, {
      name: projectName,
      srcDir: 'src',
    });
  } else {
    await cloneGitHubRepo(
      projectPath,
      'project',
      PROJECT_TEMPLATES.find(t => t.name === template).repo,
      ''
    );
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

const ensureProjectExists = async (
  accountId,
  projectName,
  { forceCreate = false, allowCreate = true, noLogs = false } = {}
) => {
  const i18nKey = 'cli.commands.project.lib.ensureProjectExists';
  const accountIdentifier = uiAccountDescription(accountId);
  try {
    const project = await fetchProject(accountId, projectName);
    return !!project;
  } catch (err) {
    if (err.statusCode === 404) {
      let shouldCreateProject = forceCreate;

      if (allowCreate && !shouldCreateProject) {
        const promptResult = await promptUser([
          {
            name: 'shouldCreateProject',
            message: i18n(`${i18nKey}.createPrompt`, {
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
            i18n(`${i18nKey}.createSuccess`, { projectName, accountIdentifier })
          );
          return true;
        } catch (err) {
          return logApiErrorInstance(err, new ApiErrorContext({ accountId }));
        }
      } else {
        if (!noLogs) {
          logger.log(
            `Your project ${chalk.bold(
              projectName
            )} could not be found in ${chalk.bold(accountIdentifier)}.`
          );
        }
        return false;
      }
    }
    logApiErrorInstance(err, new ApiErrorContext({ accountId }));
    return false;
  }
};

const getProjectDetailUrl = (projectName, accountId) => {
  if (!projectName) return;

  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/developer-projects/${accountId}/project/${projectName}`;
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
  const i18nKey = 'cli.commands.project.subcommands.upload';
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });
  const accountIdentifier = uiAccountDescription(accountId);

  spinnies.add('upload', {
    text: i18n(`${i18nKey}.loading.upload.add`, {
      accountIdentifier,
      projectName,
    }),
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
      text: i18n(`${i18nKey}.loading.upload.succeed`, {
        accountIdentifier,
        projectName,
      }),
    });

    logger.debug(
      i18n(`${i18nKey}.debug.buildCreated`, {
        buildId,
        projectName,
      })
    );
  } catch (err) {
    spinnies.fail('upload', {
      text: i18n(`${i18nKey}.loading.upload.fail`, {
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
      logger.log(i18n(`${i18nKey}.logs.projectLockedError`));
    }
    process.exit(EXIT_CODES.ERROR);
  }

  return { buildId };
};

const handleProjectUpload = async (
  accountId,
  projectConfig,
  projectDir,
  callbackFunc,
  uploadMessage
) => {
  const i18nKey = 'cli.commands.project.subcommands.upload';
  const srcDir = path.resolve(projectDir, projectConfig.srcDir);

  const filenames = fs.readdirSync(srcDir);
  if (!filenames || filenames.length === 0) {
    logger.log(
      i18n(`${i18nKey}.logs.emptySource`, { srcDir: projectConfig.srcDir })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.debug(
    i18n(`${i18nKey}.debug.compressing`, {
      path: tempFile.name,
    })
  );

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  output.on('close', async function() {
    logger.debug(
      i18n(`${i18nKey}.debug.compressed`, {
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
      callbackFunc(tempFile, buildId);
    }
  });

  archive.pipe(output);

  archive.directory(srcDir, false, file =>
    shouldIgnoreFile(file.name, true) ? false : file
  );

  archive.finalize();
};

const makePollTaskStatusFunc = ({
  statusFn,
  structureFn,
  statusText,
  statusStrings,
  linkToHubSpot,
}) => {
  const i18nKey = 'cli.commands.project.lib.makePollTaskStatusFunc';

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

  return async (accountId, taskName, taskId, deployedBuildId = null) => {
    const displayId = deployedBuildId || taskId;

    if (linkToHubSpot) {
      logger.log(
        `\n${linkToHubSpot(accountId, taskName, taskId, deployedBuildId)}\n`
      );
    }

    const spinnies = new Spinnies({
      succeedColor: 'white',
      failColor: 'white',
      failPrefix: chalk.bold('!'),
    });

    spinnies.add('overallTaskStatus', { text: 'Beginning' });

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
    const componentCountText = i18n(
      numComponents === 1
        ? `${i18nKey}.componentCountSingular`
        : `${i18nKey}.componentCount`,
      { numComponents }
    );

    spinnies.update('overallTaskStatus', {
      text: `${statusStrings.INITIALIZE(taskName)}\n${componentCountText}\n`,
    });

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
      });
    };

    structuredTasks.forEach(task => {
      addTaskSpinner(task, 2, !task.subtasks || task.subtasks.length === 0);
      task.subtasks.forEach((subtask, i) =>
        addTaskSpinner(subtask, 4, i === task.subtasks.length - 1)
      );
    });

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
                  ? i18n(`${i18nKey}.successStatusText`)
                  : i18n(`${i18nKey}.failedStatusText`);
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
              spinnies.succeed('overallTaskStatus', {
                text: statusStrings.SUCCESS(taskName),
              });
            } else if (status === statusText.STATES.FAILURE) {
              spinnies.fail('overallTaskStatus', {
                text: statusStrings.FAIL(taskName),
              });

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
  const i18nKey = 'cli.commands.project.subcommands.upload';
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    logger.log(i18n(`${i18nKey}.logs.feedbackHeader`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logs.feedbackMessage`));
  }
};

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  getIsInProject,
  handleProjectUpload,
  createProjectConfig,
  validateProjectConfig,
  getProjectDetailUrl,
  getProjectBuildDetailUrl,
  pollBuildStatus,
  pollDeployStatus,
  ensureProjectExists,
  logFeedbackMessage,
};
