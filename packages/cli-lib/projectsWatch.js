const chokidar = require('chokidar');
const path = require('path');
const { default: PQueue } = require('p-queue');
const { logApiErrorInstance, ApiErrorContext } = require('./errorHandlers');
const { i18n } = require('./lib/lang');
const { logger } = require('./logger');
const { isAllowedExtension } = require('./path');
const { shouldIgnoreFile } = require('./ignoreRules');
const {
  cancelStagedBuild,
  provisionBuild,
  uploadFileToBuild,
  queueBuild,
} = require('./api/dfs');

const i18nKey = 'cli.commands.project.subcommands.watch';

const queue = new PQueue({
  concurrency: 10,
});
const standbyeQueue = [];
let currentBuildId = null;
let handleBuildStatus;
let timer;

const bindSigIntHandler = (accountId, projectName) => {
  process.removeAllListeners('SIGINT');
  process.on('SIGINT', async () => {
    if (currentBuildId) {
      try {
        await cancelStagedBuild(accountId, projectName);
        logger.debug(i18n(`${i18nKey}.debug.buildCancelled`));
        process.exit(0);
      } catch (err) {
        logApiErrorInstance(
          err,
          new ApiErrorContext({ accountId, projectName: projectName })
        );
        process.exit(1);
      }
    } else {
      process.exit(0);
    }
  });
};

const processStandByQueue = async (accountId, projectName) => {
  queue.addAll(
    standbyeQueue.map(({ filePath, remotePath }) => {
      return async () => {
        queueFileUpload(accountId, projectName, filePath, remotePath);
      };
    })
  );
  standbyeQueue.length = 0;
  debounceQueueBuild(accountId, projectName);
};

const createNewStagingBuild = async (accountId, projectName) => {
  currentBuildId = await createNewBuild(accountId, projectName);
  logger.log(
    i18n(`${i18nKey}.logs.createNewBuild`, { buildId: currentBuildId })
  );

  bindSigIntHandler(accountId, projectName);
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
      await queueBuild(accountId, projectName, currentBuildId);
      logger.debug(i18n(`${i18nKey}.debug.buildStarted`, { projectName }));
    } catch (err) {
      logApiErrorInstance(err, new ApiErrorContext({ accountId, projectName }));
      return;
    }

    await handleBuildStatus(accountId, projectName, currentBuildId);

    await createNewStagingBuild(accountId, projectName);

    if (standbyeQueue.length > 0) {
      await processStandByQueue(accountId, projectName);
    }

    queue.start();
    logger.log(i18n(`${i18nKey}.logs.resuming`));
  }, 2000);
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
    try {
      await uploadFileToBuild(
        accountId,
        projectName,
        currentBuildId,
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
    logger.debug(i18n(`${i18nKey}.debug.attemptNewBuild`));
    const { buildId } = await provisionBuild(accountId, projectName);
    return buildId;
  } catch (err) {
    if (err.error.subCategory === 'PipelineErrors.PROJECT_LOCKED') {
      logger.error(i18n(`${i18nKey}.errors.projectLocked`));
    } else {
      logApiErrorInstance(err, new ApiErrorContext({ accountId, projectName }));
    }
    await cancelStagedBuild(accountId, projectName);
    logger.log(i18n(`${i18nKey}.logs.buildCancelled`));
    process.exit(1);
  }
};

const addFile = async (accountId, projectName, projectSourceDir, filePath) => {
  const remotePath = path.relative(projectSourceDir, filePath);
  if (queue.isPaused) {
    standbyeQueue.find(file => file.filePath === filePath)
      ? logger.debug(i18n(`${i18nKey}.debug.fileAlreadyQueued`, { filePath }))
      : standbyeQueue.push({
          filePath,
          remotePath,
        });
  } else {
    await queueFileUpload(accountId, projectName, filePath, remotePath);
  }
};

const createWatcher = async (
  accountId,
  projectConfig,
  projectDir,
  handleBuildStatusFn
) => {
  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);

  handleBuildStatus = handleBuildStatusFn;

  const watcher = chokidar.watch(projectSourceDir, {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });

  watcher.on('ready', async () => {
    logger.log(i18n(`${i18nKey}.logs.watching`, { projectDir }));
    await createNewStagingBuild(accountId, projectConfig.name);
  });
  watcher.on('add', async filePath => {
    addFile(accountId, projectConfig.name, projectSourceDir, filePath);
  });
  watcher.on('change', async filePath => {
    addFile(accountId, projectConfig.name, projectSourceDir, filePath);
  });
};

module.exports = {
  createWatcher,
};
