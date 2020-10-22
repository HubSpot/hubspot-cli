const path = require('path');
const chokidar = require('chokidar');
const { default: PQueue } = require('p-queue');

const { logger } = require('../logger');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logErrorInstance,
} = require('../errorHandlers');
const { uploadFolder } = require('./uploadFolder');
const { shouldIgnoreFile, ignoreFile } = require('../ignoreRules');
const { getFileMapperApiQueryFromMode } = require('../fileMapper');
const { upload, deleteFile, moveFile } = require('../api/fileMapper');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension, isFolder } = require('../path');
const { triggerNotify } = require('./notify');

const queue = new PQueue({
  concurrency: 10,
});

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

async function deleteRemoteFile(portalId, filePath, remoteFilePath, { cwd }) {
  if (shouldIgnoreFile(filePath, cwd)) {
    logger.debug(`Skipping ${filePath} due to an ignore rule`);
    return;
  }

  logger.debug('Attempting to delete file "%s"', remoteFilePath);
  return queue.add(() => {
    return deleteFile(portalId, remoteFilePath)
      .then(() => {
        logger.log(`Deleted file ${remoteFilePath}`);
      })
      .catch(error => {
        logger.error(`Deleting file ${remoteFilePath} failed`);
        logApiErrorInstance(
          error,
          new ApiErrorContext({
            portalId,
            request: remoteFilePath,
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
    uploadFolder(portalId, src, dest, { mode, cwd })
      .then(() => {
        logger.success(
          `Completed uploading files in ${src} to ${dest} in ${portalId}`
        );
      })
      .catch(error => {
        logger.error(
          `Initial uploading of folder "${src}" to "${dest} in portal ${portalId} failed`
        );
        logErrorInstance(error, {
          portalId,
        });
      });
  }

  watcher.on('ready', () => {
    logger.log(`Watcher is ready and watching ${src}`);
  });

  watcher.on('add', filePath => {
    if (checkIfWasMoved(filePath)) {
      return;
    }

    const destPath = getDesignManagerPath(filePath);
    const uploadPromise = uploadFile(portalId, filePath, destPath, {
      mode,
      cwd,
    });
    triggerNotify(notify, 'Added', filePath, uploadPromise);
  });

  if (remove) {
    const deleteFileOrFolder = type => filePath => {
      const remotePath = getDesignManagerPath(filePath);

      if (checkIfWasMoved(filePath)) {
        return;
      }

      if (shouldIgnoreFile(filePath, cwd)) {
        logger.debug(`Skipping ${filePath} due to an ignore rule`);
        return;
      }

      logger.debug('Attempting to delete %s "%s"', type, remotePath);
      queue.add(() => {
        const deletePromise = deleteRemoteFile(portalId, filePath, remotePath, {
          cwd,
        })
          .then(() => {
            logger.log('Deleted %s "%s"', type, remotePath);
          })
          .catch(error => {
            logger.error('Deleting %s "%s" failed', type, remotePath);
            logApiErrorInstance(
              error,
              new ApiErrorContext({
                portalId,
                request: remotePath,
              })
            );
          });
        triggerNotify(notify, 'Removed', filePath, deletePromise);
        return deletePromise;
      });
    };

    watcher.on('unlink', deleteFileOrFolder('file'));
    watcher.on('unlinkDir', deleteFileOrFolder('folder'));
  }

  watcher.on('change', filePath => {
    const destPath = getDesignManagerPath(filePath);
    const uploadPromise = uploadFile(portalId, filePath, destPath, {
      mode,
      cwd,
    });
    triggerNotify(notify, 'Changed', filePath, uploadPromise);
  });

  const movedPaths = {};
  const rawMovedPaths = [];

  const checkIfWasMoved = function(path) {
    return movedPaths[path];
  };

  watcher.on('raw', (event, path) => {
    if (event === 'moved') {
      rawMovedPaths.push(path);
      movedPaths[path] = true;

      if (rawMovedPaths.length >= 2) {
        watcher.emit('rename', rawMovedPaths.shift(), rawMovedPaths.shift());
      }
    }
  });

  watcher.on('rename', (srcPath, destPath) => {
    const remoteSrc = getDesignManagerPath(srcPath);
    const remoteDest = getDesignManagerPath(destPath);
    const type = isFolder(srcPath) ? 'folder' : 'file';

    if (shouldIgnoreFile(srcPath, cwd)) {
      logger.debug(`Skipping ${srcPath} due to an ignore rule`);
      return;
    }

    logger.debug(
      'Attempting to move %s "%s" to "%s"',
      type,
      remoteSrc,
      remoteDest
    );
    queue.add(() => {
      const deletePromise = moveFile(portalId, remoteSrc, remoteDest)
        .then(() => {
          logger.log('Moved %s "%s" to "%s"', type, remoteSrc, remoteDest);
        })
        .catch(error => {
          logger.error(
            'Moving %s "%s" to "%s" failed',
            type,
            remoteSrc,
            remoteDest
          );
          logApiErrorInstance(
            error,
            new ApiErrorContext({
              portalId,
              request: remoteSrc,
            })
          );
        })
        .finally(() => {
          delete movedPaths[srcPath];
          delete movedPaths[destPath];
        });
      triggerNotify(notify, 'Moved', srcPath, deletePromise);
      return deletePromise;
    });
  });

  return watcher;
}

module.exports = {
  watch,
};
