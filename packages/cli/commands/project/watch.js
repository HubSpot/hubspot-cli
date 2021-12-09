const chokidar = require('chokidar');
const path = require('path');
const { default: PQueue } = require('p-queue');
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
const { isAllowedExtension } = require('@hubspot/cli-lib/path');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const {
  provisionBuild,
  uploadFileToBuild,
  queueBuild,
} = require('@hubspot/cli-lib/api/dfs');
const { validateAccount } = require('../../lib/validation');
const {
  getProjectConfig,
  validateProjectConfig,
  pollBuildStatus,
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

const queue = new PQueue({
  concurrency: 10,
});

let buildInProgress = false;
let currentBuildId;

function queueFileUpload(accountId, projectName, buildId, filePath, srcDir) {
  if (!isAllowedExtension(filePath)) {
    logger.debug(`Skipping ${filePath} due to unsupported extension`);
    return;
  }
  if (shouldIgnoreFile(filePath)) {
    logger.debug(`Skipping ${filePath} due to an ignore rule`);
    return;
  }
  const remotePath = path.relative(srcDir, filePath);

  logger.debug('Attempting to upload file "%s" to "%s"', filePath, remotePath);

  return queue.add(() => {
    return uploadFileToBuild(
      accountId,
      projectName,
      currentBuildId,
      filePath,
      remotePath
    )
      .then(() => {
        logger.log(`Uploaded file ${filePath} to ${remotePath}`);
      })
      .catch(() => {
        logger.log(`Failed to upload file ${filePath} to ${remotePath}`);
      });
  });
}

const createNewBuild = async (accountId, projectName) => {
  try {
    const { buildId } = await provisionBuild(accountId, projectName);
    currentBuildId = buildId;
  } catch (err) {
    if (err.error.subCategory === 'PipelineErrors.PROJECT_LOCKED') {
      logger.error('Project is locked, cannot create new build');
    } else if (err.error.subCategory === 'PipelineErrors.MISSING_PROJECT') {
      logger.error(`Project ${projectName} does not exist.`);
    } else {
      logger.error(err.error);
    }
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

  createNewBuild(accountId, projectConfig.name);

  const watcher = chokidar.watch(path.join(projectDir, projectConfig.srcDir), {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });
  let timer;

  const refreshTimeout = () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      queue.onIdle().then(async () => {
        logger.debug('Pausing watcher, attempting to queue build');
        queue.pause();

        try {
          await queueBuild(accountId, projectConfig.name, currentBuildId);
          buildInProgress = true;
          logger.log('Build queued.');
        } catch (err) {
          logger.error(err);
          process.exit(1);
        }

        const { status } = await pollBuildStatus(
          accountId,
          projectConfig.name,
          currentBuildId
        );
        if (status === 'SUCCESS') {
          logger.debug('Build succeeded, resuming watcher');
          createNewBuild(accountId, projectConfig.name);
          buildInProgress = false;
          queue.start();
        } else {
          logger.log('Build failed.');
          process.exit(1);
        }
      });
    }, 5000);
  };

  watcher.on('ready', () => {
    logger.log(
      `Watcher is ready and watching ${projectDir}. Any changes detected will be automatically uploaded and overwrite the current version in the developer file system.`
    );
  });

  watcher.on('add', filePath => {
    if (!buildInProgress) {
      refreshTimeout();
    }

    queueFileUpload(
      accountId,
      projectConfig.name,
      currentBuildId,
      filePath,
      path.join(projectDir, projectConfig.srcDir)
    );
  });
  watcher.on('change', filePath => {
    if (!buildInProgress) {
      refreshTimeout();
    }

    queueFileUpload(
      accountId,
      projectConfig.name,
      currentBuildId,
      filePath,
      path.join(projectDir, projectConfig.srcDir)
    );
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
