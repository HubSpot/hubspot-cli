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
  deleteFileFromBuild,
  queueBuild,
} = require('./api/dfs');

const i18nKey = 'cli.commands.project.subcommands.watch';

const queue = new PQueue({
  concurrency: 10,
});
const standbyeQueue = [];
let currentBuildId = null;
let handleBuildStatus, handleSigInt;
let timer;

const processStandByQueue = async (accountId, projectName) => {
  queue.addAll(
    standbyeQueue.map(({ filePath, remotePath, action }) => {
      return async () => {
        queueFileUpload(accountId, projectName, filePath, remotePath, action);
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

  handleSigInt(accountId, projectName, currentBuildId);
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
      await queueBuild(accountId, projectName);
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
  remotePath,
  action
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
    if (action === 'upload') {
      try {
        await uploadFileToBuild(accountId, projectName, filePath, remotePath);

        logger.log(
          i18n(`${i18nKey}.logs.uploadSucceeded`, { filePath, remotePath })
        );
      } catch (err) {
        logger.debug(
          i18n(`${i18nKey}.debug.uploadFailed`, { filePath, remotePath })
        );
      }
    } else if (action === 'delete') {
      try {
        await deleteFileFromBuild(accountId, projectName, remotePath);

        logger.log(
          i18n(`${i18nKey}.logs.deleteSucceeded`, { filePath, remotePath })
        );
      } catch (err) {
        logger.debug(
          i18n(`${i18nKey}.debug.deleteFailed`, { filePath, remotePath })
        );
      }
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

const addFile = async (
  accountId,
  projectName,
  projectSourceDir,
  filePath,
  action = 'upload'
) => {
  const remotePath = path.relative(projectSourceDir, filePath);
  if (queue.isPaused) {
    standbyeQueue.find(file => file.filePath === filePath)
      ? logger.debug(i18n(`${i18nKey}.debug.fileAlreadyQueued`, { filePath }))
      : standbyeQueue.push({
          filePath,
          remotePath,
          action,
        });
  } else {
    await queueFileUpload(accountId, projectName, filePath, remotePath, action);
  }
};

const createWatcher = async (
  accountId,
  projectConfig,
  projectDir,
  handleBuildStatusFn,
  handleSigIntFn
) => {
  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);

  handleBuildStatus = handleBuildStatusFn;
  handleSigInt = handleSigIntFn;

  await createNewStagingBuild(accountId, projectConfig.name);

  const watcher = chokidar.watch(projectSourceDir, {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });
  watcher.on('ready', async () => {
    logger.log(i18n(`${i18nKey}.logs.watching`, { projectDir }));
  });
  watcher.on('add', async filePath => {
    addFile(accountId, projectConfig.name, projectSourceDir, filePath);
  });
  watcher.on('change', async filePath => {
    addFile(accountId, projectConfig.name, projectSourceDir, filePath);
  });
  watcher.on('unlink', async filePath => {
    addFile(
      accountId,
      projectConfig.name,
      projectSourceDir,
      filePath,
      'delete'
    );
  });
};

module.exports = {
  createWatcher,
};
