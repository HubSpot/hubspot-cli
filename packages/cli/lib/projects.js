const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const findup = require('findup-sync');
const { prompt } = require('inquirer');
const Spinnies = require('Spinnies');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  POLLING_DELAY,
} = require('@hubspot/cli-lib/lib/constants');
const { getBuildStatus } = require('@hubspot/cli-lib/api/dfs');

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

  logger.log('Project building...');
  for (let subBuild of buildStatus.subbuildStatuses) {
    spinnies.add(subBuild.buildName, {
      text: `The build for "${subBuild.buildName}" has not started`,
    });
  }

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const { status, subbuildStatuses } = await getBuildStatus(
        accountId,
        name,
        buildId
      );

      subbuildStatuses.forEach(subBuild => {
        switch (subBuild.status) {
          case 'SUCCESS':
            spinnies.succeed(subBuild.buildName, {
              text: `The build for "${subBuild.buildName}" has succeeded`,
            });
            break;
          case 'FAILURE':
            spinnies.fail(subBuild.buildName, {
              text: `The build for "${subBuild.buildName}" has failed`,
            });
            break;
          default:
            spinnies.update(subBuild.buildName, {
              text: `The build for "${subBuild.buildName}" is ${subBuild.status}`,
            });
            break;
        }
      });

      if (status === 'SUCCESS') {
        logger.success('Build finished successfully');
        clearInterval(pollInterval);
        resolve(buildStatus);
      } else if (status === 'ERROR') {
        logger.error('Build failed');
        clearInterval(pollInterval);
        reject(buildStatus);
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
