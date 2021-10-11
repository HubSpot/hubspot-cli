const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const findup = require('findup-sync');
const { prompt } = require('inquirer');
const Spinnies = require('spinnies');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  POLLING_DELAY,
  PROJECT_BUILD_STATUS,
  PROJECT_TEXT,
} = require('@hubspot/cli-lib/lib/constants');
const { PROJECTS } = require('./strings');
const {
  getBuildStatus,
  getDeployStatus,
  fetchProject,
  createProject,
} = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');

const isTaskComplete = task => {
  return (
    // Todo: rework these enum keys
    task.status === PROJECT_BUILD_STATUS.SUCCESS ||
    task.status === PROJECT_BUILD_STATUS.FAILURE
  );
};

const writeProjectConfig = (configPath, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.error(`Could not write project config at ${configPath}`);
  }
};

const getProjectConfig = async projectPath => {
  const configPath = findup('hsproject.json', {
    cwd: projectPath,
    nocase: true,
  });

  if (!configPath) {
    return null;
  }

  try {
    const projectConfig = fs.readFileSync(configPath);
    return JSON.parse(projectConfig);
  } catch (e) {
    logger.error('Could not read from project config');
  }
};

const getOrCreateProjectConfig = async projectPath => {
  const projectConfig = await getProjectConfig(projectPath);

  if (!projectConfig) {
    const { name, srcDir } = await prompt([
      {
        name: 'name',
        message: 'Please enter a project name:',
        validate: input => {
          if (!input) {
            return 'A project name is required';
          }
          return true;
        },
      },
      {
        name: 'srcDir',
        message: 'Which directory contains your project files?',
        validate: input => {
          if (!input) {
            return 'A source directory is required';
          }
          return true;
        },
      },
    ]);
    writeProjectConfig(path.join(projectPath, 'hsproject.json'), {
      name,
      srcDir,
    });
    return { name, srcDir };
  }

  return projectConfig;
};

const validateProjectConfig = (projectConfig, projectDir) => {
  if (!projectConfig) {
    logger.error(
      `Project config not found. Try running 'hs project init' first.`
    );
    process.exit(1);
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    logger.error(
      'Project config is missing required fields. Try running `hs project init`.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(path.resolve(projectDir, projectConfig.srcDir))) {
    logger.error(
      `Project source directory '${projectConfig.srcDir}' does not exist.`
    );
    process.exit(1);
  }
};

const ensureProjectExists = async (accountId, projectName) => {
  try {
    await fetchProject(accountId, projectName);
  } catch (err) {
    if (err.statusCode === 404) {
      const { shouldCreateProject } = await prompt([
        {
          name: 'shouldCreateProject',
          message: `The project ${projectName} does not exist in ${accountId}. Would you like to create it?`,
          type: 'confirm',
        },
      ]);

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

const showWelcomeMessage = (projectName, accountId) => {
  const projectDetailUrl = getProjectDetailUrl(projectName, accountId);

  logger.log('');
  logger.log(chalk.bold('> Welcome to HubSpot Developer Projects!'));
  logger.log(
    '\n-------------------------------------------------------------\n'
  );
  if (projectDetailUrl) {
    logger.log(chalk.italic(`View this project at: ${projectDetailUrl}`));
  }
  logger.log('');
  logger.log(chalk.bold('Getting Started'));
  logger.log('');
  logger.log('1. hs project upload');
  logger.log(
    '   Upload your project files to HubSpot. Upload action adds your files to a build.'
  );
  logger.log();
  logger.log('2. View your changes on the preview build url');
  logger.log();
  logger.log('Use `hs project --help` to learn more about the command.');
  logger.log(
    '\n-------------------------------------------------------------\n'
  );
};

const makeGetTaskStatus = taskType => {
  let statusFn, statusText, statusStrings;
  switch (taskType) {
    case 'build':
      statusFn = getBuildStatus;
      statusText = PROJECT_TEXT.BUILD;
      statusStrings = PROJECTS.BUILD;
      break;
    case 'deploy':
      statusFn = getDeployStatus;
      statusText = PROJECT_TEXT.DEPLOY;
      statusStrings = PROJECTS.DEPLOY;
      break;
    default:
      logger.error(`Cannot get status for task type ${taskType}`);
  }

  return async (accountId, taskName, taskId) => {
    const spinnies = new Spinnies({
      succeedColor: 'white',
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
        text: `${chalk.bold(subTask[statusText.SUBTASK_NAME_KEY])} #${taskId} ${
          statusText.STATUS_TEXT[statusText.STATES.ENQUEUED]
        }\n`,
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
                spinnies.fail(subTask.buildName, {
                  text: updatedText,
                });
                break;
              default:
                spinnies.update(subTask.buildName, {
                  text: updatedText,
                });
                break;
            }
          });
        }

        if (isTaskComplete(taskStatus) && spinnies.hasActiveSpinners()) {
          subTaskStatus.forEach(subBuild => {
            spinnies.remove(subBuild[statusText.SUBTASK_NAME_KEY]);
          });

          if (status === statusText.STATES.SUCCESS) {
            spinnies.succeed('overallTaskStatus', {
              text: statusStrings.SUCCESS(taskName),
            });
          } else if (status === statusText.STATES.FAILURE) {
            spinnies.fail('overallTaskStatus');
            logger.error(
              `Your project ${chalk.bold(taskName)} ${
                statusText.STATES[status]
              }.`
            );
          }

          clearInterval(pollInterval);
          resolve(taskStatus);
        }
      }, POLLING_DELAY);
    });
  };
};

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  getOrCreateProjectConfig,
  validateProjectConfig,
  showWelcomeMessage,
  pollBuildStatus: makeGetTaskStatus('build'),
  pollDeployStatus: makeGetTaskStatus('deploy'),
  ensureProjectExists,
};
