const fs = require('fs');
const path = require('path');

const findup = require('findup-sync');
const { prompt } = require('inquirer');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');

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

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  getOrCreateProjectConfig,
  validateProjectConfig,
  getProjectDetailUrl,
};
