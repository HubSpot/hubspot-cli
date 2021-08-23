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
} = require('@hubspot/cli-lib/lib/constants');
const { getBuildStatus } = require('@hubspot/cli-lib/api/dfs');

const BUILD_STATUS = {
  BUILDING: 'BUILDING',
  ENQUEUED: 'ENQUEUED',
  FAILURE: 'FAILURE',
  SUCCESS: 'SUCCESS',
};

const BUILD_STATUS_TEXT = {
  [BUILD_STATUS.BUILDING]: 'is building',
  [BUILD_STATUS.ENQUEUED]: 'is queued',
  [BUILD_STATUS.FAILURE]: 'failed to build',
  [BUILD_STATUS.SUCCESS]: 'built successfully',
};

const isBuildComplete = build => {
  return (
    build.status === BUILD_STATUS.SUCCESS ||
    build.status === BUILD_STATUS.FAILURE
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
        message: 'name',
      },
      {
        name: 'srcDir',
        message: 'srcDir',
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

  logger.log(`Building project ${name}...`);
  for (let subBuild of buildStatus.subbuildStatuses) {
    spinnies.add(subBuild.buildName, {
      text: `"${subBuild.buildName}" ${
        BUILD_STATUS_TEXT[BUILD_STATUS.ENQUEUED]
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
          const updatedText = `"${subBuild.buildName}" ${
            BUILD_STATUS_TEXT[subBuild.status]
          }`;

          switch (subBuild.status) {
            case BUILD_STATUS.SUCCESS:
              spinnies.succeed(subBuild.buildName, {
                text: updatedText,
              });
              break;
            case BUILD_STATUS.FAILURE:
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

        if (status === BUILD_STATUS.SUCCESS) {
          logger.success(`Your project ${name} ${BUILD_STATUS_TEXT[status]}.`);
        } else if (status === BUILD_STATUS.FAILURE) {
          logger.error(`Your project ${name} ${BUILD_STATUS_TEXT[status]}.`);
          subbuildStatuses.forEach(subBuild => {
            if (subBuild.status === BUILD_STATUS.FAILURE) {
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
