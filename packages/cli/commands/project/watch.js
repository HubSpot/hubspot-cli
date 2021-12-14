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
const standbyeQueue = [];
let timer;

const processStandByQueue = async (accountId, projectName) => {
  await currentBuild.update(accountId, projectName);
  queue.addAll(
    standbyeQueue.map(({ filePath, remotePath }) => {
      return async () => {
        try {
          await uploadFileToBuild(
            accountId,
            projectName,
            currentBuild.get(),
            filePath,
            remotePath
          );
          logger.log(
            i18n(`${i18nKey}.logs.uploadSucceeded`, { filePath, remotePath })
          );
        } catch (err) {
          logger.debug(
            i18n(`${i18nKey}.debug.uploadFailed`, {
              filePath,
              remotePath,
            })
          );
        }
      };
    })
  );
  standbyeQueue.length = 0;
  debounceQueueBuild(accountId, projectName);
};

const currentBuild = {
  id: null,
  isFetchingNewBuildId: false,
  get: () => {
    return this.id;
  },
  update: async (accountId, projectName) => {
    if (this.id) {
      return this.id;
    }
    if (this.isFetchingNewBuildId) {
      return;
    }
    logger.log(i18n(`${i18nKey}.logs.createNewBuild`));
    this.isFetchingNewBuildId = true;
    this.id = await createNewBuild(accountId, projectName);
    this.isFetchingNewBuildId = false;
  },
  clear: () => {
    this.id = null;
  },
};

const debounceQueueBuild = (accountId, projectName) => {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(async () => {
    logger.debug(i18n(`${i18nKey}.debug.pause`, { projectName }));
    queue.pause();
    await queue.onIdle();

    try {
      await queueBuild(accountId, projectName, currentBuild.get());
      logger.debug(i18n(`${i18nKey}.debug.buildStarted`, { projectName }));
    } catch (err) {
      logApiErrorInstance(err, new ApiErrorContext({ accountId, projectName }));
      return;
    }

    await pollBuildStatus(accountId, projectName, currentBuild.get());
    currentBuild.clear();

    if (standbyeQueue.length > 0) {
      await processStandByQueue(accountId, projectName);
    }

    queue.start();
    logger.log(i18n(`${i18nKey}.logs.resuming`));
  }, 5000);
};

const queueFileUpload = async (
  accountId,
  projectName,
  filePath,
  remotePath
) => {
  if (!isAllowedExtension(filePath)) {
    logger.debug(i18n(`${i18nKey}.debug.extensionNotAllowed`, { filePath }));
    return;
  }
  if (shouldIgnoreFile(filePath)) {
    logger.debug(i18n(`${i18nKey}.debug.ignored`, { filePath }));
    return;
  }
  if (!queue.isPaused) {
    debounceQueueBuild(accountId, projectName);
  }

  logger.debug(i18n(`${i18nKey}.debug.uploading`, { filePath, remotePath }));

  return queue.add(async () => {
    await currentBuild.update(accountId, projectName);
    try {
      await uploadFileToBuild(
        accountId,
        projectName,
        currentBuild.get(),
        filePath,
        remotePath
      );
      logger.log(
        i18n(`${i18nKey}.logs.uploadSucceeded`, { filePath, remotePath })
      );
    } catch (err) {
      logger.debug(
        i18n(`${i18nKey}.debug.uploadFailed`, { filePath, remotePath })
      );
    }
  });
};

const createNewBuild = async (accountId, projectName) => {
  try {
    logger.debug('Attempting to create a new build');
    const { buildId } = await provisionBuild(accountId, projectName);
    return buildId;
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
    const remotePath = path.relative(
      path.join(projectDir, projectConfig.srcDir),
      filePath
    );
    if (queue.isPaused) {
      standbyeQueue.push({
        filePath,
        remotePath,
      });
      return;
    }
    await queueFileUpload(accountId, projectConfig.name, filePath, remotePath);
  });
  watcher.on('change', async filePath => {
    const remotePath = path.relative(
      path.join(projectDir, projectConfig.srcDir),
      filePath
    );
    if (queue.isPaused) {
      standbyeQueue.push({
        filePath,
        remotePath,
      });
      return;
    }
    await queueFileUpload(accountId, projectConfig.name, filePath, remotePath);
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
