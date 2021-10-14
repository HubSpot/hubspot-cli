const fs = require('fs-extra');
const path = require('path');

const chalk = require('chalk');
const findup = require('findup-sync');
const { prompt } = require('inquirer');
const Spinnies = require('spinnies');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { createProject } = require('@hubspot/cli-lib/projects');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  POLLING_DELAY,
  PROJECT_BUILD_STATUS,
  PROJECT_BUILD_STATUS_TEXT,
  PROJECT_DEPLOY_STATUS,
  PROJECT_DEPLOY_STATUS_TEXT,
  PROJECT_TEMPLATE_REPO,
} = require('@hubspot/cli-lib/lib/constants');
const { getBuildStatus, getDeployStatus } = require('@hubspot/cli-lib/api/dfs');

const isBuildComplete = build => {
  return (
    build.status === PROJECT_BUILD_STATUS.SUCCESS ||
    build.status === PROJECT_BUILD_STATUS.FAILURE
  );
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

const createProjectConfig = async (projectPath, projectName) => {
  const projectConfig = await getProjectConfig(projectPath);
  const projectConfigPath = path.join(projectPath, 'hsproject.json');

  if (projectConfig) {
    logger.log(
      `Found an existing project config in this folder (${chalk.bold(
        projectConfig.name
      )})`
    );
  } else {
    logger.log(
      `Creating project in ${projectPath ? projectPath : 'the current folder'}`
    );
    const { name, template, srcDir } = await prompt([
      {
        name: 'name',
        message: 'Please enter a project name:',
        when: !projectName,
        validate: input => {
          if (!input) {
            return 'A project name is required';
          }
          return true;
        },
      },
      {
        name: 'template',
        message: 'Start from a template?',
        type: 'rawlist',
        choices: [
          {
            name: 'No template',
            value: 'none',
          },
          {
            name: 'Getting Started Project',
            value: 'getting-started',
          },
        ],
      },
    ]);

    if (template === 'none') {
      fs.ensureDirSync(path.join(projectPath, 'src'));

      writeProjectConfig(projectConfigPath, {
        name: projectName || name,
        srcDir: 'src',
      });
    } else {
      await createProject(
        projectPath,
        'project',
        PROJECT_TEMPLATE_REPO[template],
        ''
      );
      const _config = JSON.parse(fs.readFileSync(projectConfigPath));
      writeProjectConfig(projectConfigPath, {
        ..._config,
        name: projectName || name,
      });
    }

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
  logger.log('🎨 Add deployables to your project with `hs create`.\n');
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
  createProjectConfig,
  validateProjectConfig,
  showWelcomeMessage,
  pollBuildStatus,
  pollDeployStatus,
  getProjectDetailUrl,
};
