const chokidar = require('chokidar');
const path = require('path');
const chalk = require('chalk');
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
const { ERROR_TYPES } = require('./lib/constants');

const i18nKey = 'cli.commands.project.subcommands.watch';

const queue = new PQueue({
  concurrency: 10,
});
const standbyeQueue = [];
let currentBuildId = null;
let handleBuildStatus, handleUserInput;
let timer;

const processStandByQueue = async (accountId, projectName) => {
  queue.addAll(
    standbyeQueue.map(({ filePath, remotePath, action }) => {
      return async () => {
        queueFileOrFolder(accountId, projectName, filePath, remotePath, action);
      };
    })
  );
  standbyeQueue.length = 0;
  debounceQueueBuild(accountId, projectName);
};

const createNewStagingBuild = async (accountId, projectName) => {
  currentBuildId = await createNewBuild(accountId, projectName);

  handleUserInput(accountId, projectName, currentBuildId);
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
      if (
        err.error &&
        err.error.subCategory === ERROR_TYPES.MISSING_PROJECT_PROVISION
      ) {
        logger.log(i18n(`${i18nKey}.logs.watchCancelledFromUi`));
        process.exit(0);
      } else {
        logApiErrorInstance(
          err,
          new ApiErrorContext({ accountId, projectName })
        );
      }

      return;
    }

    await handleBuildStatus(accountId, projectName, currentBuildId);

    await createNewStagingBuild(accountId, projectName);

    if (standbyeQueue.length > 0) {
      await processStandByQueue(accountId, projectName);
    }

    queue.start();
    logger.log(i18n(`${i18nKey}.logs.resuming`));
    logger.log(`\n> Press ${chalk.bold('q')} to quit watching\n`);
  }, 2000);
};

const queueFileOrFolder = async (
  accountId,
  projectName,
  filePath,
  remotePath,
  action
) => {
  if (action === 'upload' && !isAllowedExtension(filePath)) {
    logger.debug(i18n(`${i18nKey}.debug.extensionNotAllowed`, { filePath }));
    return;
  }
  if (shouldIgnoreFile(filePath, true)) {
    logger.debug(i18n(`${i18nKey}.debug.ignored`, { filePath }));
    return;
  }
  if (!queue.isPaused) {
    debounceQueueBuild(accountId, projectName);
  }

  logger.debug(i18n(`${i18nKey}.debug.uploading`, { filePath, remotePath }));

  return queue.add(async () => {
    try {
      if (action === 'upload') {
        await uploadFileToBuild(accountId, projectName, filePath, remotePath);
      } else if (action === 'deleteFile' || action === 'deleteFolder') {
        await deleteFileFromBuild(accountId, projectName, remotePath);
      }
      logger.log(
        i18n(`${i18nKey}.logs.${action}Succeeded`, { filePath, remotePath })
      );
    } catch (err) {
      logger.debug(
        i18n(`${i18nKey}.errors.${action}Failed`, { filePath, remotePath })
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
    logApiErrorInstance(err, new ApiErrorContext({ accountId, projectName }));
    if (err.error.subCategory !== ERROR_TYPES.PROJECT_LOCKED) {
      await cancelStagedBuild(accountId, projectName);
      logger.log(i18n(`${i18nKey}.logs.previousStagingBuildCancelled`));
    }
    process.exit(1);
  }
};

const handleWatchEvent = async (
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
    await queueFileOrFolder(
      accountId,
      projectName,
      filePath,
      remotePath,
      action
    );
  }
};

const createWatcher = async (
  accountId,
  projectConfig,
  projectDir,
  handleBuildStatusFn,
  handleUserInputFn
) => {
  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);

  handleBuildStatus = handleBuildStatusFn;
  handleUserInput = handleUserInputFn;

  await createNewStagingBuild(accountId, projectConfig.name);

  const watcher = chokidar.watch(projectSourceDir, {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });
  watcher.on('ready', async () => {
    logger.log(i18n(`${i18nKey}.logs.watching`, { projectDir }));
    logger.log(`\n> Press ${chalk.bold('q')} to quit watching\n`);
  });
  watcher.on('add', async path => {
    handleWatchEvent(accountId, projectConfig.name, projectSourceDir, path);
  });
  watcher.on('change', async path => {
    handleWatchEvent(accountId, projectConfig.name, projectSourceDir, path);
  });
  watcher.on('unlink', async path => {
    handleWatchEvent(
      accountId,
      projectConfig.name,
      projectSourceDir,
      path,
      'deleteFile'
    );
  });
  watcher.on('unlinkDir', async path => {
    handleWatchEvent(
      accountId,
      projectConfig.name,
      projectSourceDir,
      path,
      'deleteFolder'
    );
  });
};

module.exports = {
  createWatcher,
};
