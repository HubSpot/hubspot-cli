const fs = require('fs-extra');
const path = require('path');

const chalk = require('chalk');
const findup = require('findup-sync');
const { prompt } = require('inquirer');
const Spinnies = require('spinnies');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const {
  createProject: createProjectTemplate,
} = require('@hubspot/cli-lib/projects');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  POLLING_DELAY,
  PROJECT_TEMPLATES,
  PROJECT_TEXT,
  PROJECT_CONFIG_FILE,
} = require('@hubspot/cli-lib/lib/constants');
const {
  createProject,
  getBuildStatus,
  getDeployStatus,
  fetchProject,
} = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { getCwd } = require('@hubspot/cli-lib/path');
const { EXIT_CODES } = require('./exitCodes');
const { getAccountDescription } = require('../lib/ui');

const PROJECT_STRINGS = {
  BUILD: {
    INITIALIZE: (name, numOfComponents) =>
      `Building ${chalk.bold(name)}\n\nFound ${numOfComponents} component${
        numOfComponents !== 1 ? 's' : ''
      } in this project ...\n`,
    SUCCESS: name => `Built ${chalk.bold(name)}`,
    FAIL: name => `Failed to build ${chalk.bold(name)}`,
  },
  DEPLOY: {
    INITIALIZE: (name, numOfComponents) =>
      `Deploying ${chalk.bold(name)}\n\nFound ${numOfComponents} component${
        numOfComponents !== 1 ? 's' : ''
      } in this project ...\n`,
    SUCCESS: name => `Deployed ${chalk.bold(name)}`,
    FAIL: name => `Failed to deploy ${chalk.bold(name)}`,
  },
};

const writeProjectConfig = (configPath, config) => {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.error(`Could not write project config at ${configPath}`);
  }
};

const getProjectConfig = async _dir => {
  const projectDir = _dir ? path.resolve(getCwd(), _dir) : getCwd();

  const configPath = findup(PROJECT_CONFIG_FILE, {
    cwd: projectDir,
    nocase: true,
  });

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

    const { shouldContinue } = await prompt([
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
      return;
    }
  }

  const projectConfigPath = path.join(projectPath, PROJECT_CONFIG_FILE);

  logger.log(
    `Creating project in ${projectPath ? projectPath : 'the current folder'}`
  );

  if (template === 'none') {
    fs.ensureDirSync(path.join(projectPath, 'src'));

    writeProjectConfig(projectConfigPath, {
      name: projectName,
      srcDir: 'src',
    });
  } else {
    await createProjectTemplate(
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

  return projectConfig;
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

const ensureProjectExists = async (accountId, projectName, forceCreate) => {
  try {
    await fetchProject(accountId, projectName);
  } catch (err) {
    if (err.statusCode === 404) {
      let shouldCreateProject = forceCreate;

      if (!shouldCreateProject) {
        const promptResult = await prompt([
          {
            name: 'shouldCreateProject',
            message: `The project ${projectName} does not exist in ${getAccountDescription(
              accountId
            )}. Would you like to create it?`,
            type: 'confirm',
          },
        ]);
        shouldCreateProject = promptResult.shouldCreateProject;
      }

      if (shouldCreateProject) {
        try {
          return createProject(accountId, projectName);
        } catch (err) {
          return logApiErrorInstance(err, new ApiErrorContext({ accountId }));
        }
      } else {
        return logger.log(
          `Your project ${chalk.bold(
            projectName
          )} could not be found in ${chalk.bold(accountId)}.`
        );
      }
    }
    logApiErrorInstance(err, new ApiErrorContext({ accountId }));
  }
};

const getProjectDetailUrl = (projectName, accountId) => {
  if (!projectName) return;

  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/developer-projects/${accountId}/project/${projectName}`;
};

const showWelcomeMessage = () => {
  logger.log('');
  logger.log(chalk.bold('Welcome to HubSpot Developer Projects!'));
  logger.log(
    '\n-------------------------------------------------------------\n'
  );
  logger.log(chalk.bold("What's next?\n"));
  logger.log('🎨 Add components to your project with `hs create`.\n');
  logger.log(
    `🏗  Run \`hs project upload\` to upload your files to HubSpot and trigger builds.\n`
  );
  logger.log(
    `🚀 Ready to take your project live? Run \`hs project deploy\`.\n`
  );
  logger.log(
    `🔗 Use \`hs project --help\` to learn more about available commands.\n`
  );
  logger.log('-------------------------------------------------------------');
};

const makeGetTaskStatus = taskType => {
  let statusFn, statusText, statusStrings;
  switch (taskType) {
    case 'build':
      statusFn = getBuildStatus;
      statusText = PROJECT_TEXT.BUILD;
      statusStrings = PROJECT_STRINGS.BUILD;
      break;
    case 'deploy':
      statusFn = getDeployStatus;
      statusText = PROJECT_TEXT.DEPLOY;
      statusStrings = PROJECT_STRINGS.DEPLOY;
      break;
    default:
      logger.error(`Cannot get status for task type ${taskType}`);
  }

  return async (accountId, taskName, taskId, buildId) => {
    const isTaskComplete = task => {
      if (task.status === statusText.STATES.FAILURE) {
        return true;
      } else if (task.status === statusText.STATES.SUCCESS) {
        return task.isAutoDeployEnabled ? !!task.deployStatusTaskLocator : true;
      }
    };

    const spinnies = new Spinnies({
      succeedColor: 'white',
      failColor: 'white',
    });

    spinnies.add('overallTaskStatus', { text: 'Beginning' });

    const initialTaskStatus = await statusFn(accountId, taskName, taskId);

    spinnies.update('overallTaskStatus', {
      text: statusStrings.INITIALIZE(
        taskName,
        initialTaskStatus[statusText.SUBTASK_KEY].length
      ),
    });

    for (let subTask of initialTaskStatus[statusText.SUBTASK_KEY]) {
      spinnies.add(subTask[statusText.SUBTASK_NAME_KEY], {
        text: `${chalk.bold(subTask[statusText.SUBTASK_NAME_KEY])} #${buildId ||
          taskId} ${statusText.STATUS_TEXT[statusText.STATES.ENQUEUED]}\n`,
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
            if (!spinnies.pick(subTask[statusText.SUBTASK_NAME_KEY])) {
              return;
            }

            const updatedText = `${chalk.bold(
              subTask[statusText.SUBTASK_NAME_KEY]
            )} #${taskId} ${statusText.STATUS_TEXT[subTask.status]}\n`;

            switch (subTask.status) {
              case statusText.STATES.SUCCESS:
                spinnies.succeed(subTask[statusText.SUBTASK_NAME_KEY], {
                  text: updatedText,
                });
                break;
              case statusText.STATES.FAILURE:
                spinnies.fail(subTask[statusText.SUBTASK_NAME_KEY], {
                  text: updatedText,
                });
                break;
              default:
                spinnies.update(subTask[statusText.SUBTASK_NAME_KEY], {
                  text: updatedText,
                });
                break;
            }
          });

          if (isTaskComplete(taskStatus)) {
            subTaskStatus.forEach(subTask => {
              spinnies.remove(subTask[statusText.SUBTASK_NAME_KEY]);
            });

            if (status === statusText.STATES.SUCCESS) {
              spinnies.succeed('overallTaskStatus', {
                text: statusStrings.SUCCESS(taskName),
              });
            } else if (status === statusText.STATES.FAILURE) {
              spinnies.fail('overallTaskStatus', {
                text: statusStrings.FAIL(taskName),
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

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  createProjectConfig,
  validateProjectConfig,
  showWelcomeMessage,
  getProjectDetailUrl,
  pollBuildStatus: makeGetTaskStatus('build'),
  pollDeployStatus: makeGetTaskStatus('deploy'),
  ensureProjectExists,
};
