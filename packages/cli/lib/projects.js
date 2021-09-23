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
  PROJECT_BUILD_STATUS_TEXT,
  PROJECT_DEPLOY_STATUS,
  PROJECT_DEPLOY_STATUS_TEXT,
} = require('@hubspot/cli-lib/lib/constants');
const {
  getBuildStatus,
  getDeployStatus,
  fetchProject,
  createProject,
} = require('@hubspot/cli-lib/api/dfs');
const { logApiErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const isBuildComplete = build => {
  return (
    build.status === PROJECT_BUILD_STATUS.SUCCESS ||
    build.status === PROJECT_BUILD_STATUS.FAILURE
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

const validateProjectConfig = projectConfig => {
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

  if (!fs.existsSync(projectConfig.srcDir)) {
    logger.error(
      `Project source directory '${projectConfig.srcDir}' does not exist.`
    );
    process.exit(1);
  }
};

const ensureProject = async (accountId, projectName) => {
  try {
    await fetchProject(accountId, projectName);
  } catch (err) {
    if (err.statusCode === 404) {
      const { shouldCreateProject } = await prompt([
        {
          name: 'shouldCreateProject',
          message: `This project does not exist in: . Would you like to create it?`,
          type: 'confirm',
        },
      ]);
      if (shouldCreateProject) {
        try {
          await createProject(accountId, projectName);
        } catch (err) {
          logApiErrorInstance(err);
        }
      } else {
        logger.log(
          `Your project ${chalk.bold(
            projectName
          )} could not be found in ${chalk.bold(accountId)}.`
        );
        process.exit(1);
      }
    }
    logApiErrorInstance(err);
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

const pollBuildStatus = async (accountId, name, buildId) => {
  const buildStatus = await getBuildStatus(accountId, name, buildId);
  const spinnies = new Spinnies();

  logger.log();
  logger.log(`Building ${chalk.bold(name)}`);
  logger.log();
  logger.log(`Found ${buildStatus.subbuildStatuses.length} deployables ...`);
  logger.log();

  for (let subBuild of buildStatus.subbuildStatuses) {
    spinnies.add(subBuild.buildName, {
      text: `${chalk.bold(subBuild.buildName)} #${buildId} ${
        PROJECT_BUILD_STATUS_TEXT[PROJECT_BUILD_STATUS.ENQUEUED]
      }`,
    });
  }

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const buildStatus = await getBuildStatus(accountId, name, buildId).catch(
        reject
      );
      const { status, subbuildStatuses } = buildStatus;

      if (spinnies.hasActiveSpinners()) {
        subbuildStatuses.forEach(subBuild => {
          if (!spinnies.pick(subBuild.buildName)) {
            return;
          }

          const updatedText = `${chalk.bold(subBuild.buildName)} #${buildId} ${
            PROJECT_BUILD_STATUS_TEXT[subBuild.status]
          }`;

          switch (subBuild.status) {
            case PROJECT_BUILD_STATUS.SUCCESS:
              spinnies.succeed(subBuild.buildName, {
                text: updatedText,
              });
              break;
            case PROJECT_BUILD_STATUS.FAILURE:
              spinnies.fail(subBuild.buildName, {
                text: updatedText,
              });
              break;
            default:
              spinnies.update(subBuild.buildName, {
                text: updatedText,
              });
              break;
          }
        });
      }

      if (isBuildComplete(buildStatus)) {
        clearInterval(pollInterval);

        if (status === PROJECT_BUILD_STATUS.SUCCESS) {
          logger.success(
            `Your project ${chalk.bold(name)} ${
              PROJECT_BUILD_STATUS_TEXT[status]
            }.`
          );
        } else if (status === PROJECT_BUILD_STATUS.FAILURE) {
          logger.error(
            `Your project ${chalk.bold(name)} ${
              PROJECT_BUILD_STATUS_TEXT[status]
            }.`
          );
          subbuildStatuses.forEach(subBuild => {
            if (subBuild.status === PROJECT_BUILD_STATUS.FAILURE) {
              logger.error(
                `${chalk.bold(subBuild.buildName)} failed to build. ${
                  subBuild.errorMessage
                }.`
              );
            }
          });
        }
        resolve(buildStatus);
      }
    }, POLLING_DELAY);
  });
};

const pollDeployStatus = async (accountId, name, deployId, deployedBuildId) => {
  const deployStatus = await getDeployStatus(accountId, name, deployId);
  const spinnies = new Spinnies();

  logger.log();
  logger.log(`Deploying ${chalk.bold(name)}`);
  logger.log();
  logger.log(
    `Found ${deployStatus.subdeployStatuses.length} sub-build deploys ...`
  );
  logger.log();

  for (let subdeploy of deployStatus.subdeployStatuses) {
    spinnies.add(subdeploy.deployName, {
      text: `${chalk.bold(subdeploy.deployName)} #${deployedBuildId} ${
        PROJECT_DEPLOY_STATUS_TEXT[PROJECT_DEPLOY_STATUS.ENQUEUED]
      }`,
    });
  }

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const deployStatus = await getDeployStatus(
        accountId,
        name,
        deployId
      ).catch(reject);

      const { status, subdeployStatuses } = deployStatus;

      if (spinnies.hasActiveSpinners()) {
        subdeployStatuses.forEach(subdeploy => {
          if (!spinnies.pick(subdeploy.deployName)) {
            return;
          }

          const updatedText = `${chalk.bold(
            subdeploy.deployName
          )} #${deployedBuildId} ${
            PROJECT_DEPLOY_STATUS_TEXT[subdeploy.status]
          }`;

          switch (subdeploy.status) {
            case PROJECT_DEPLOY_STATUS.SUCCESS:
              spinnies.succeed(subdeploy.deployName, {
                text: updatedText,
              });
              break;
            case PROJECT_DEPLOY_STATUS.FAILURE:
              spinnies.fail(subdeploy.deployName, {
                text: updatedText,
              });
              break;
            default:
              spinnies.update(subdeploy.deployName, {
                text: updatedText,
              });
              break;
          }
        });
      }

      if (isBuildComplete(deployStatus)) {
        clearInterval(pollInterval);

        if (status === PROJECT_DEPLOY_STATUS.SUCCESS) {
          logger.success(
            `Your project ${chalk.bold(name)} ${
              PROJECT_DEPLOY_STATUS_TEXT[status]
            }.`
          );
        } else if (status === PROJECT_DEPLOY_STATUS.FAILURE) {
          logger.error(
            `Your project ${chalk.bold(name)} ${
              PROJECT_DEPLOY_STATUS_TEXT[status]
            }.`
          );
          subdeployStatuses.forEach(subdeploy => {
            if (subdeploy.status === PROJECT_DEPLOY_STATUS.FAILURE) {
              logger.error(
                `${chalk.bold(subdeploy.deployName)} failed to build. ${
                  subdeploy.errorMessage
                }.`
              );
            }
          });
        }
        resolve(deployStatus);
      }
    }, POLLING_DELAY);
  });
};

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  getOrCreateProjectConfig,
  validateProjectConfig,
  showWelcomeMessage,
  pollBuildStatus,
  pollDeployStatus,
  ensureProject,
};
