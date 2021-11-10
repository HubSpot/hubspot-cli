const chokidar = require('chokidar');
const path = require('path');
const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
// const {
//   logApiErrorInstance,
//   ApiErrorContext,
// } = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const { provisionBuild } = require('@hubspot/cli-lib/api/dfs');
const { validateAccount } = require('../../lib/validation');
const {
  getProjectConfig,
  validateProjectConfig,
} = require('../../lib/projects');

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

exports.command = 'watch [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-watch', { projectPath }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  let buildId;
  try {
    buildId = await provisionBuild(accountId, projectConfig.name);
  } catch (err) {
    if (err.error.subCategory === 'PipelineErrors.PROJECT_LOCKED') {
      logger.error(`Project ${projectConfig.name} is locked.`);
    } else if (err.error.subCategory === 'PipelineErrors.MISSING_PROJECT') {
      logger.error(`Project ${projectConfig.name} does not exist.`);
    } else {
      logger.error(err.error);
    }
    process.exit(1);
  }
  console.log(buildId);
  const watcher = chokidar.watch(path.join(projectDir, projectConfig.srcDir), {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });

  watcher.on('ready', () => {
    logger.log(
      `Watcher is ready and watching ${projectDir}. Any changes detected will be automatically uploaded and overwrite the current version in the developer file system.`
    );
  });

  watcher.on('add', filePath => {
    logger.log('add', filePath);
  });
  watcher.on('change', filePath => {
    logger.log('change', filePath);
  });
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.example([
    [
      '$0 project wwatch myProjectFolder',
      'Watch a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
