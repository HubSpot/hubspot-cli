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
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
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
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.watch';

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
let currentBuildId = null;
let timer;

const refreshTimeout = (accountId, projectName) => {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(() => {
    queue.onIdle().then(async () => {
      logger.debug(i18n(`${i18nKey}.debug.pause`, { projectName }));
      queue.pause();

      try {
        await queueBuild(accountId, projectName, currentBuildId);
        buildInProgress = true;
        logger.debug(i18n(`${i18nKey}.debug.buildStarted`, { projectName }));
      } catch (err) {
        logApiErrorInstance(
          err,
          new ApiErrorContext({ accountId, projectName })
        );
        return;
      }

      await pollBuildStatus(accountId, projectName, currentBuildId);
      currentBuildId = null;
      buildInProgress = false;
      queue.start();
      logger.log(i18n(`${i18nKey}.logs.resuming`));
    });
  }, 5000);
};

const queueFileUpload = async (accountId, projectName, filePath, srcDir) => {
  if (!isAllowedExtension(filePath)) {
    logger.debug(i18n(`${i18nKey}.debug.extensionNotAllowed`, { filePath }));
    return;
  }
  if (shouldIgnoreFile(filePath)) {
    logger.debug(i18n(`${i18nKey}.debug.ignored`, { filePath }));
    return;
  }
  if (!currentBuildId) {
    await createNewBuild(accountId, projectName);
  }
  if (!buildInProgress) {
    refreshTimeout(accountId, projectName);
  }

  const remotePath = path.relative(srcDir, filePath);

  logger.debug(i18n(`${i18nKey}.debug.uploading`, { filePath, remotePath }));

  return queue.add(() => {
    return uploadFileToBuild(
      accountId,
      projectName,
      currentBuildId,
      filePath,
      remotePath
    )
      .then(() => {
        logger.log(i18n(`${i18nKey}.logs.uploadSucceeded`, { remotePath }));
      })
      .catch(() => {
        logger.debug(
          i18n(`${i18nKey}.debug.uploadFailed`, { filePath, remotePath })
        );
      });
  });
};

const createNewBuild = async (accountId, projectName) => {
  try {
    logger.debug('Attempting to create a new build');
    const { buildId } = await provisionBuild(accountId, projectName);
    currentBuildId = buildId;
    return;
  } catch (err) {
    if (err.error.subCategory === 'PipelineErrors.PROJECT_LOCKED') {
      logger.error('Project is locked, cannot create new build');
    } else if (err.error.subCategory === 'PipelineErrors.MISSING_PROJECT') {
      logger.error(`Project ${projectName} does not exist.`);
    } else {
      logApiErrorInstance(err, new ApiErrorContext({ accountId, projectName }));
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

  const watcher = chokidar.watch(path.join(projectDir, projectConfig.srcDir), {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });

  watcher.on('ready', () => {
    logger.log(i18n(`${i18nKey}.logs.watching`, { projectPath }));
  });
  watcher.on('add', async filePath => {
    await queueFileUpload(
      accountId,
      projectConfig.name,
      filePath,
      path.join(projectDir, projectConfig.srcDir)
    );
  });
  watcher.on('change', async filePath => {
    await queueFileUpload(
      accountId,
      projectConfig.name,
      filePath,
      path.join(projectDir, projectConfig.srcDir)
    );
  });
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 project wwatch myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
