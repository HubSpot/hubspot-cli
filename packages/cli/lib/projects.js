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
  POLLING_DELAY,
  PROJECT_TEMPLATES,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  PROJECT_CONFIG_FILE,
} = require('@hubspot/cli-lib/lib/constants');
const {
  createProject,
  getBuildStatus,
  getDeployStatus,
  fetchProject,
  uploadProject,
} = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const { getCwd } = require('@hubspot/cli-lib/path');
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

const getIsInProject = async _dir => {
  const configPath = await getProjectConfigPath(_dir);
  return !!configPath;
};

const getProjectConfigPath = async _dir => {
  const projectDir = _dir ? path.resolve(getCwd(), _dir) : getCwd();

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

  if (template === 'none') {
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
  { forceCreate = false, allowCreate = true } = {}
) => {
  try {
    await fetchProject(accountId, projectName);
  } catch (err) {
    if (err.statusCode === 404) {
      let shouldCreateProject = forceCreate;

      if (allowCreate && !shouldCreateProject) {
        const promptResult = await promptUser([
          {
            name: 'shouldCreateProject',
            message: `The project ${projectName} does not exist in ${uiAccountDescription(
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

const getProjectBuildDetailUrl = (projectName, buildId, accountId) => {
  if (!projectName || !buildId || !accountId) return;
  return `${getProjectDetailUrl(projectName, accountId)}/build/${buildId}`;
};

const uploadProjectFiles = async (accountId, projectName, filePath) => {
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
    const upload = await uploadProject(accountId, projectName, filePath);

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
    process.exit(EXIT_CODES.ERROR);
  }

  return { buildId };
};

const handleProjectUpload = async (
  accountId,
  projectConfig,
  projectDir,
  callbackFunc
) => {
  const i18nKey = 'cli.commands.project.subcommands.upload';
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
      tempFile.name
    );

    if (callbackFunc) {
      callbackFunc(tempFile, buildId);
    }
  });

  archive.pipe(output);

  archive.directory(
    path.resolve(projectDir, projectConfig.srcDir),
    false,
    file => (shouldIgnoreFile(file.name) ? false : file)
  );

  archive.finalize();
};

const showProjectWelcomeMessage = () => {
  logger.log('');
  logger.log(chalk.bold('Welcome to HubSpot Developer Projects!'));
  logger.log('\n');
  uiLine();
  logger.log('\n');
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
  uiLine();
};

const makePollTaskStatusFunc = ({
  statusFn,
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

  return async (accountId, taskName, taskId) => {
    let hubspotLinkText = '';
    if (linkToHubSpot) {
      logger.log(`\n${linkToHubSpot(taskName, taskId, accountId)}\n`);
    }

    const spinnies = new Spinnies({
      succeedColor: 'white',
      failColor: 'white',
      failPrefix: chalk.bold('!'),
    });

    spinnies.add('overallTaskStatus', { text: 'Beginning' });

    const initialTaskStatus = await statusFn(accountId, taskName, taskId);

    const numOfComponents = initialTaskStatus[statusText.SUBTASK_KEY].length;
    const componentCountText = `\nFound ${numOfComponents} component${
      numOfComponents !== 1 ? 's' : ''
    } in this project ...\n`;

    spinnies.update('overallTaskStatus', {
      text: `${statusStrings.INITIALIZE(taskName)}${componentCountText}`,
    });

    for (let subTask of initialTaskStatus[statusText.SUBTASK_KEY]) {
      const subTaskName = subTask[statusText.SUBTASK_NAME_KEY];

      spinnies.add(subTaskName, {
        text: `${chalk.bold(subTaskName)} #${taskId} ${
          statusText.STATUS_TEXT[statusText.STATES.ENQUEUED]
        }\n`,
        indent: 2,
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
            const subTaskName = subTask[statusText.SUBTASK_NAME_KEY];

            if (!spinnies.pick(subTaskName)) {
              return;
            }

            const updatedText = `${chalk.bold(subTaskName)} #${taskId} ${
              statusText.STATUS_TEXT[subTask.status]
            }\n`;

            switch (subTask.status) {
              case statusText.STATES.SUCCESS:
                spinnies.succeed(subTaskName, { text: updatedText });
                break;
              case statusText.STATES.FAILURE:
                spinnies.fail(subTaskName, { text: updatedText });
                break;
              default:
                spinnies.update(subTaskName, { text: updatedText });
                break;
            }
          });

          if (isTaskComplete(taskStatus)) {
            subTaskStatus.forEach(subTask => {
              spinnies.remove(subTask[statusText.SUBTASK_NAME_KEY]);
            });

            if (status === statusText.STATES.SUCCESS) {
              spinnies.succeed('overallTaskStatus', {
                text: `${statusStrings.SUCCESS(taskName)}${hubspotLinkText}`,
              });
            } else if (status === statusText.STATES.FAILURE) {
              spinnies.fail('overallTaskStatus', {
                text: `${statusStrings.FAIL(taskName)}${hubspotLinkText}`,
              });

              const failedSubtask = subTaskStatus.filter(
                subtask => subtask.status === 'FAILURE'
              );

              uiLine();
              logger.log(
                `${statusStrings.SUBTASK_FAIL(
                  taskId,
                  failedSubtask.length === 1
                    ? failedSubtask[0][statusText.SUBTASK_NAME_KEY]
                    : failedSubtask.length + ' components'
                )}\n`
              );
              logger.log('See below for a summary of errors.');
              uiLine();

              failedSubtask.forEach(subTask => {
                logger.log(
                  `\n--- ${chalk.bold(subTask[statusText.SUBTASK_NAME_KEY])} ${
                    statusText.STATUS_TEXT[subTask.status]
                  } with the following error ---`
                );
                logger.error(subTask.errorMessage);
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
  linkToHubSpot: (projectName, buildId, accountId) =>
    uiLink(
      `View build #${buildId} in HubSpot`,
      getProjectBuildDetailUrl(projectName, buildId, accountId),
      { useColor: true }
    ),
  statusFn: getBuildStatus,
  statusText: PROJECT_BUILD_TEXT,
  statusStrings: {
    INITIALIZE: name => `Building ${chalk.bold(name)}`,
    SUCCESS: name => `Built ${chalk.bold(name)}`,
    FAIL: name => `Failed to build ${chalk.bold(name)}`,
    SUBTASK_FAIL: (taskId, name) =>
      `Build #${taskId} failed because there was a problem\nbuilding ${chalk.bold(
        name
      )}`,
  },
});

const pollDeployStatus = makePollTaskStatusFunc({
  statusFn: getDeployStatus,
  statusText: PROJECT_DEPLOY_TEXT,
  statusStrings: {
    INITIALIZE: name => `Deploying ${chalk.bold(name)}`,
    SUCCESS: name => `Deployed ${chalk.bold(name)}`,
    FAIL: name => `Failed to deploy ${chalk.bold(name)}`,
    SUBTASK_FAIL: (taskId, name) =>
      `Deploy for build #${taskId} failed because there was a\nproblem deploying ${chalk.bold(
        name
      )}`,
  },
});

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  getIsInProject,
  handleProjectUpload,
  createProjectConfig,
  validateProjectConfig,
  showProjectWelcomeMessage,
  getProjectDetailUrl,
  getProjectBuildDetailUrl,
  pollBuildStatus,
  pollDeployStatus,
  ensureProjectExists,
};
