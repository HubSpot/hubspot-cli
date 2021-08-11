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

exports.command = 'init [path]';
exports.describe = false;

const getProjectConfig = p => {
  const projectDirectory = findup('hsproject.json', {
    cwd: p,
    nocase: true,
  });

  if (!projectDirectory) {
    return {};
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

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath, name, label, description } = options;
  const accountId = getAccountId(options);

  // TODO:
  // trackCommandUsage('projects-init', { projectPath }, accountId);

  const cwd = path ? path.resolve(getCwd(), projectPath) : getCwd();
  const _projectConfig = getProjectConfig(cwd);

  const projectConfig = {
    name: name || _projectConfig.name,
    label: label || _projectConfig.label,
    description: description || _projectConfig.description,
  };

  if (!projectConfig.name) {
    const { name } = await prompt({ name: 'name' });
    projectConfig.name = name;
  }

  logger.log(`Initializing project: ${projectConfig.name}`);

  try {
    //  TODO: API only supports name at the moment
    const project = await createProject(accountId, projectConfig.name);

    writeProjectConfig(path.join(cwd, 'hsproject.json'), project);

    logger.success(
      `Created project in ${projectPath} on account ${accountId}.`
    );
  } catch (e) {
    if (e.statusCode === 409) {
      logger.error(e.error.message);
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
      '$0 projects init myProjectFolder',
      'Initialize a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
