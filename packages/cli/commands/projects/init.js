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

const writeProjectConfig = (configPath, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.error(`Could not write project config at ${configPath}`);
  }
};

const getOrCreateProjectConfig = async projectPath => {
  const configPath = findup('hsproject.json', {
    cwd: projectPath,
    nocase: true,
  });

  if (!configPath) {
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
  } else {
    try {
      const projectConfig = fs.readFileSync(configPath);
      return JSON.parse(projectConfig);
    } catch (e) {
      logger.error('Could not read from project config');
    }
  }
};

exports.command = 'init [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  // TODO:
  // trackCommandUsage('projects-init', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();
  const projectConfig = await getOrCreateProjectConfig(cwd);

  logger.log(`Initializing project: ${projectConfig.name}`);

  try {
    await createProject(accountId, projectConfig.name);

    logger.success(
      `"${projectConfig.name}" creation succeeded in account ${accountId}`
    );
  } catch (e) {
    if (e.statusCode === 409) {
      logger.log(
        `Project ${projectConfig.name} already exists in ${accountId}.`
      );
    } else {
      return logApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, projectPath })
      );
    }
  }
  logger.log('');
  logger.log('> Welcome to HubSpot Developer Projects!');
  logger.log('-------------------------------------------------------------');
  logger.log('Getting Started');
  logger.log('1. hs project upload');
  logger.log(
    '   Upload your project files to HubSpot. Upload action adds your files to a build.'
  );
  logger.log();
  logger.log('2. View your changes on the preview build url');
  logger.log();
  logger.log('Use `hs project --help` to learn more about the command.');
  logger.log('-------------------------------------------------------------');
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
    srcDir: {
      describe: 'Directory of project',
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
