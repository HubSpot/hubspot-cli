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
} = require('@hubspot/cli-lib/lib/constants');
const { getBuildStatus } = require('@hubspot/cli-lib/api/dfs');

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

  logger.log(`Building project '${name}'...`);
  for (let subBuild of buildStatus.subbuildStatuses) {
    spinnies.add(subBuild.buildName, {
      text: `'${subBuild.buildName}' ${
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

      if (Object.keys(spinnies.spinners).length) {
        subbuildStatuses.forEach(subBuild => {
          const updatedText = `'${subBuild.buildName}' ${
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
            `Your project '${name}' ${PROJECT_BUILD_STATUS_TEXT[status]}.`
          );
        } else if (status === PROJECT_BUILD_STATUS.FAILURE) {
          logger.error(
            `Your project '${name}' ${PROJECT_BUILD_STATUS_TEXT[status]}.`
          );
          subbuildStatuses.forEach(subBuild => {
            if (subBuild.status === PROJECT_BUILD_STATUS.FAILURE) {
              logger.error(
                `${subBuild.buildName} failed to build. ${subBuild.errorMessage}.`
              );
            }
          });
        }
        resolve(buildStatus);
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
};
