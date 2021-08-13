const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
// const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { createProject } = require('@hubspot/cli-lib/api/dfs');
const { validateAccount } = require('../../lib/validation');
const { prompt } = require('inquirer');
const fs = require('fs');
const findup = require('findup-sync');
const { getCwd } = require('../../../cli-lib/path');
const path = require('path');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

const promptValue = async (value, message) => {
  const prompted = await prompt({
    name: value,
    message: message,
  });
  return prompted[value];
};

const getProjectConfig = path => {
  const projectDirectory = findup('hsproject.json', {
    cwd: path,
    nocase: true,
  });

  if (!projectDirectory) {
    return null;
  }

  try {
    const projectConfig = fs.readFileSync(projectDirectory);
    return JSON.parse(projectConfig);
  } catch (e) {
    logger.error('Could not read from project config');
  }
};

const writeProjectConfig = (configPath, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.log(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.error(`Could not write project config at ${configPath}`);
  }
};

exports.command = 'init [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath, name, projectDir, label, description } = options;
  const accountId = getAccountId(options);

  // TODO:
  // trackCommandUsage('projects-init', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();
  const projectConfigFile = getProjectConfig(cwd);

  const projectConfig = {
    accountId,
    name: name || (await promptValue('name', 'Please provide a project name:')),
    projectDir:
      projectDir ||
      (await promptValue('projectDir', 'Please provide a project directory:')),
    ...(label && { label }),
    ...(description && { description }),
  };

  logger.log(`Initializing project: ${projectConfig.name}`);

  try {
    // TODO: API only supports name at the moment
    await createProject(accountId, projectConfig.name);

    writeProjectConfig(path.join(cwd, 'hsproject.json'), {
      ...projectConfigFile,
      projects: [...projectConfigFile.projects, projectConfig],
    });

    logger.success(
      `"${projectConfig.label ||
        projectConfig.name}" creation succeeded in account ${accountId}.`
    );
  } catch (e) {
    if (e.statusCode === 409) {
      logger.log(
        `Project ${projectConfig.name} already exists. Updating project config file...`
      );
      const filteredProjects = projectConfigFile.projects.filter(
        project => project.name !== projectConfig.name
      );
      writeProjectConfig(path.join(cwd, 'hsproject.json'), {
        ...projectConfigFile,
        projects: [...filteredProjects, projectConfig],
      });
    } else {
      logApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, projectPath })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.options({
    name: {
      describe: 'Project name (cannot be changed)',
      type: 'string',
    },
    projectDir: {
      describe: 'Directory of project',
      type: 'string',
    },
    label: {
      describe: 'Project label',
      type: 'string',
    },
    description: {
      describe: 'Description of project',
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project init myProjectFolder',
      'Initialize a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
