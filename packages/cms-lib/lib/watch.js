const path = require('path');
const fs = require('fs');
const moment = require('moment');
const chokidar = require('chokidar');
const debounce = require('debounce');
const { default: PQueue } = require('p-queue');

const { logger } = require('../logger');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
} = require('../errorHandlers');
const { uploadFolder } = require('./uploadFolder');
const { shouldIgnoreFile, ignoreFile } = require('../ignoreRules');
const { getFileMapperApiQueryFromMode } = require('../fileMapper');
const { upload, deleteFile } = require('../api/fileMapper');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension } = require('../path');

const WATCH_ACTION = {
  ADD: {
    EVENT: 'add',
    ACTION: 'Added',
  },
  REMOVE: {
    EVENT: 'unlink',
    ACTION: 'Removed',
  },
  CHANGE: {
    EVENT: 'change',
    ACTION: 'Changed',
  },
};

const notifyQueue = [];
const debouncedWriteNotifyQueueToFile = debounce(writeNotifyQueueToFile, 1500);

const queue = new PQueue({
  concurrency: 10,
});

function triggerNotify(notify, actionType, filePath) {
  if (notify) {
    notifyQueue.push(`${moment().toISOString()} ${actionType}: ${filePath}\n`);
    debouncedWriteNotifyQueueToFile(notify);
  }
}

function writeNotifyQueueToFile(notify) {
  if (notify) {
    try {
      const notifyOutput = `${moment().toISOString()} Notify Triggered\n`;
      const output = notifyQueue.join('').concat(notifyOutput);
      fs.appendFileSync(notify, output);
      notifyQueue.length = 0;
    } catch (e) {
      logger.error(`Unable to notify file ${notify}: ${e}`);
    }
  }
}

function uploadFile(portalId, file, dest, { mode, cwd }) {
  if (!isAllowedExtension(file)) {
    logger.debug(`Skipping ${file} due to unsupported extension`);
    return;
  }
  if (shouldIgnoreFile(file, cwd)) {
    logger.debug(`Skipping ${file} due to an ignore rule`);
    return;
  }

  logger.debug('Attempting to upload file "%s" to "%s"', file, dest);
  const apiOptions = {
    qs: getFileMapperApiQueryFromMode(mode),
  };
  return queue.add(() => {
    return upload(portalId, file, dest, apiOptions)
      .then(() => {
        logger.log(`Uploaded file ${file} to ${dest}`);
      })
      .catch(() => {
        const uploadFailureMessage = `Uploading file ${file} to ${dest} failed`;
        logger.debug(uploadFailureMessage);
        logger.debug('Retrying to upload file "%s" to "%s"', file, dest);
        return upload(portalId, file, dest, apiOptions).catch(error => {
          logger.error(uploadFailureMessage);
          logApiUploadErrorInstance(
            error,
            new ApiErrorContext({
              portalId,
              request: dest,
              payload: file,
            })
          );
        });
      });
  });
}

async function deleteRemotePath(portalId, filePath, remotePath, { cwd }) {
  if (shouldIgnoreFile(filePath, cwd)) {
    logger.debug(`Skipping ${filePath} due to an ignore rule`);
    return;
  }

  logger.debug('Attempting to delete file "%s"', remotePath);
  return queue.add(() => {
    return deleteFile(portalId, remotePath)
      .then(() => {
        logger.log(`Deleted file ${remotePath}`);
      })
      .catch(error => {
        logger.error(`Deleting file ${remotePath} failed`);
        logApiErrorInstance(
          error,
          new ApiErrorContext({
            portalId,
            request: remotePath,
          })
        );
      });
  });
}

function watch(
  portalId,
  src,
  dest,
  { mode, cwd, remove, disableInitial, notify }
) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);

  if (notify) {
    ignoreFile(notify);
  }

  const watcher = chokidar.watch(src, {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file, cwd),
  });

  const getDesignManagerPath = file => {
    const relativePath = file.replace(regex, '');
    return convertToUnixPath(path.join(dest, relativePath));
  };

  if (!disableInitial) {
    // Use uploadFolder so that failures of initial upload are retried
    uploadFolder(portalId, src, dest, { mode, cwd }).then(() => {
      logger.log(
        `Completed uploading files in ${src} to ${dest} in ${portalId}`
      );
    });
  }

  watcher.on('ready', () => {
    logger.log(`Watcher is ready and watching ${src}`);
  });

  watcher.on(WATCH_ACTION.ADD.EVENT, async filePath => {
    const destPath = getDesignManagerPath(filePath);
    await uploadFile(portalId, filePath, destPath, {
      mode,
      cwd,
    });
    triggerNotify(notify, WATCH_ACTION.ADD.ACTION, filePath);
  });

  if (remove) {
    watcher.on(WATCH_ACTION.REMOVE.EVENT, async filePath => {
      const remotePath = getDesignManagerPath(filePath);
      await deleteRemotePath(portalId, filePath, remotePath, {
        cwd,
      });
      triggerNotify(notify, WATCH_ACTION.REMOVE.ACTION, filePath);
    });
  }

  watcher.on(WATCH_ACTION.CHANGE.EVENT, async filePath => {
    const destPath = getDesignManagerPath(filePath);
    await uploadFile(portalId, filePath, destPath, {
      mode,
      cwd,
    });
    triggerNotify(notify, WATCH_ACTION.CHANGE.ACTION, filePath);
  });

  return watcher;
}

module.exports = {
  watch,
};
