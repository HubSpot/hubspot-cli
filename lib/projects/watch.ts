import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';
import PQueue from 'p-queue';
import { logger } from '@hubspot/local-dev-lib/logger';
import { isAllowedExtension } from '@hubspot/local-dev-lib/path';
import { JSR_ALLOWED_EXTENSIONS } from '@hubspot/local-dev-lib/constants/extensions';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import {
  cancelStagedBuild,
  provisionBuild,
  uploadFileToBuild,
  deleteFileFromBuild,
  queueBuild,
} from '@hubspot/local-dev-lib/api/projects';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';

import { logError, ApiErrorContext } from '../errorHandlers';
import { PROJECT_ERROR_TYPES } from '../constants';
import { ProjectConfig } from '../../types/Projects';
import { commands } from '../../lang/en';

type ProjectWatchHandlerFunction = (
  accountId: number,
  projectName: string,
  currentBuildId: number
) => Promise<void>;

type WatchEvent = {
  filePath: string;
  remotePath: string;
  action: string;
};

const queue = new PQueue({
  concurrency: 10,
});
const standbyQueue: WatchEvent[] = [];
let currentBuildId: number;
let handleBuildStatus: ProjectWatchHandlerFunction;
let handleUserInput: ProjectWatchHandlerFunction;
let timer: NodeJS.Timeout;

async function processStandByQueue(
  accountId: number,
  projectName: string,
  platformVersion: string
): Promise<void> {
  queue.addAll(
    standbyQueue.map(({ filePath, remotePath, action }) => {
      return async () => {
        queueFileOrFolder(
          accountId,
          projectName,
          platformVersion,
          filePath,
          remotePath,
          action
        );
      };
    })
  );
  standbyQueue.length = 0;
  debounceQueueBuild(accountId, projectName, platformVersion);
}
async function createNewStagingBuild(
  accountId: number,
  projectName: string,
  platformVersion: string
): Promise<void> {
  currentBuildId = await createNewBuild(
    accountId,
    projectName,
    platformVersion
  );

  handleUserInput(accountId, projectName, currentBuildId);
}

function debounceQueueBuild(
  accountId: number,
  projectName: string,
  platformVersion: string
): void {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(async () => {
    logger.debug(commands.project.watch.debug.pause);
    queue.pause();
    await queue.onIdle();

    try {
      await queueBuild(accountId, projectName, platformVersion);
      logger.debug(commands.project.watch.debug.buildStarted);
    } catch (err) {
      if (
        isSpecifiedError(err, {
          subCategory: PROJECT_ERROR_TYPES.MISSING_PROJECT_PROVISION,
        })
      ) {
        logger.log(commands.project.watch.logs.watchCancelledFromUi);
        process.exit(0);
      } else {
        logError(err, new ApiErrorContext({ accountId }));
      }

      return;
    }

    await handleBuildStatus(accountId, projectName, currentBuildId);

    await createNewStagingBuild(accountId, projectName, platformVersion);

    if (standbyQueue.length > 0) {
      await processStandByQueue(accountId, projectName, platformVersion);
    }

    queue.start();
    logger.log(commands.project.watch.logs.resuming);
    logger.log(`\n> Press ${chalk.bold('q')} to quit watching\n`);
  }, 2000);
}

async function queueFileOrFolder(
  accountId: number,
  projectName: string,
  platformVersion: string,
  filePath: string,
  remotePath: string,
  action: string
): Promise<void> {
  if (
    action === 'upload' &&
    !isAllowedExtension(filePath, Array.from(JSR_ALLOWED_EXTENSIONS))
  ) {
    logger.debug(commands.project.watch.debug.extensionNotAllowed(filePath));
    return;
  }
  if (shouldIgnoreFile(filePath, true)) {
    logger.debug(commands.project.watch.debug.ignored(filePath));
    return;
  }
  if (!queue.isPaused) {
    debounceQueueBuild(accountId, projectName, platformVersion);
  }

  logger.debug(commands.project.watch.debug.uploading(filePath, remotePath));

  return queue.add(async () => {
    try {
      if (action === 'upload') {
        await uploadFileToBuild(accountId, projectName, filePath, remotePath);
      } else if (action === 'deleteFile' || action === 'deleteFolder') {
        await deleteFileFromBuild(accountId, projectName, remotePath);
      }
      logger.log(
        // @ts-expect-error
        commands.project.watch.logs[`${action}Succeeded`](remotePath, filePath)
      );
    } catch (err) {
      logger.debug(
        // @ts-expect-error
        commands.project.watch.errors[`${action}Failed`](remotePath, filePath)
      );
    }
  });
}

async function createNewBuild(
  accountId: number,
  projectName: string,
  platformVersion: string
) {
  try {
    logger.debug(commands.project.watch.debug.attemptNewBuild);
    const {
      data: { buildId },
    } = await provisionBuild(accountId, projectName, platformVersion);
    return buildId;
  } catch (err) {
    logError(err, new ApiErrorContext({ accountId }));
    if (
      isSpecifiedError(err, { subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED })
    ) {
      await cancelStagedBuild(accountId, projectName);
      logger.log(commands.project.watch.logs.previousStagingBuildCancelled);
    }
    process.exit(1);
  }
}

async function handleWatchEvent(
  accountId: number,
  projectName: string,
  platformVersion: string,
  projectSourceDir: string,
  filePath: string,
  action = 'upload'
) {
  const remotePath = path.relative(projectSourceDir, filePath);
  if (queue.isPaused) {
    if (standbyQueue.find(file => file.filePath === filePath)) {
      logger.debug(commands.project.watch.debug.fileAlreadyQueued(filePath));
    } else {
      standbyQueue.push({
        filePath,
        remotePath,
        action,
      });
    }
  } else {
    await queueFileOrFolder(
      accountId,
      projectName,
      platformVersion,
      filePath,
      remotePath,
      action
    );
  }
}

export async function createWatcher(
  accountId: number,
  projectConfig: ProjectConfig,
  projectDir: string,
  handleBuildStatusFn: ProjectWatchHandlerFunction,
  handleUserInputFn: ProjectWatchHandlerFunction
) {
  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);

  handleBuildStatus = handleBuildStatusFn;
  handleUserInput = handleUserInputFn;

  await createNewStagingBuild(
    accountId,
    projectConfig.name,
    projectConfig.platformVersion
  );

  const watcher = chokidar.watch(projectSourceDir, {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });
  watcher.on('ready', async () => {
    logger.log(commands.project.watch.logs.watching(projectDir));
    logger.log(`\n> Press ${chalk.bold('q')} to quit watching\n`);
  });
  watcher.on('add', async path => {
    handleWatchEvent(
      accountId,
      projectConfig.name,
      projectConfig.platformVersion,
      projectSourceDir,
      path
    );
  });
  watcher.on('change', async path => {
    handleWatchEvent(
      accountId,
      projectConfig.name,
      projectConfig.platformVersion,
      projectSourceDir,
      path
    );
  });
  watcher.on('unlink', async path => {
    handleWatchEvent(
      accountId,
      projectConfig.name,
      projectConfig.platformVersion,
      projectSourceDir,
      path,
      'deleteFile'
    );
  });
  watcher.on('unlinkDir', async path => {
    handleWatchEvent(
      accountId,
      projectConfig.name,
      projectConfig.platformVersion,
      projectSourceDir,
      path,
      'deleteFolder'
    );
  });
}
