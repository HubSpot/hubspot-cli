import path = require('path');
import chokidar = require('chokidar');
import { default as PQueue } from 'p-queue';

import { logger } from '../logger';
import {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logErrorInstance,
} from '../errorHandlers';
import { uploadFolder } from './uploadFolder';
import { shouldIgnoreFile, ignoreFile } from '../ignoreRules';
import { getFileMapperApiQueryFromMode } from '../fileMapper';
import { upload, deleteFile } from '../api/fileMapper';
import escapeRegExp from './escapeRegExp';
import { convertToUnixPath, isAllowedExtension } from '../path';
import { triggerNotify } from './notify';

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

export function watch(
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
        logger.log(
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

  watcher.on('add', async filePath => {
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

  watcher.on('change', async filePath => {
    const destPath = getDesignManagerPath(filePath);
    const uploadPromise = uploadFile(portalId, filePath, destPath, {
      mode,
      cwd,
    });
    triggerNotify(notify, 'Changed', filePath, uploadPromise);
  });

  return watcher;
}
