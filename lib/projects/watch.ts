import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';
import PQueue from 'p-queue';
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

import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { PROJECT_ERROR_TYPES } from '../constants.js';
import { ProjectConfig } from '../../types/Projects.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

type ProjectWatchHandlerFunction = (
  accountId: number,
  projectName: string,
  currentBuildId: number
) => Promise<void> | void;

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
    uiLogger.debug(commands.project.watch.debug.pause);
    queue.pause();
    await queue.onIdle();

    try {
      await queueBuild(accountId, projectName, platformVersion);
      uiLogger.debug(commands.project.watch.debug.buildStarted);
    } catch (err) {
      if (
        isSpecifiedError(err, {
          subCategory: PROJECT_ERROR_TYPES.MISSING_PROJECT_PROVISION,
        })
      ) {
        uiLogger.log(commands.project.watch.logs.watchCancelledFromUi);
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
    uiLogger.log(commands.project.watch.logs.resuming);
    uiLogger.log(`\n> Press ${chalk.bold('q')} to quit watching\n`);
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
    uiLogger.debug(commands.project.watch.debug.extensionNotAllowed(filePath));
    return;
  }
  if (shouldIgnoreFile(filePath, true)) {
    uiLogger.debug(commands.project.watch.debug.ignored(filePath));
    return;
  }
  if (!queue.isPaused) {
    debounceQueueBuild(accountId, projectName, platformVersion);
  }

  uiLogger.debug(commands.project.watch.debug.uploading(filePath, remotePath));

  return queue.add(async () => {
    try {
      if (action === 'upload') {
        await uploadFileToBuild(accountId, projectName, filePath, remotePath);
      } else if (action === 'deleteFile' || action === 'deleteFolder') {
        await deleteFileFromBuild(accountId, projectName, remotePath);
      }
      uiLogger.log(
        // @ts-expect-error
        commands.project.watch.logs[`${action}Succeeded`](remotePath, filePath)
      );
    } catch (err) {
      uiLogger.debug(
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
    uiLogger.debug(commands.project.watch.debug.attemptNewBuild);
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
      uiLogger.log(commands.project.watch.logs.previousStagingBuildCancelled);
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
      uiLogger.debug(commands.project.watch.debug.fileAlreadyQueued(filePath));
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
    uiLogger.log(commands.project.watch.logs.watching(projectDir));
    uiLogger.log(`\n> Press ${chalk.bold('q')} to quit watching\n`);
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
