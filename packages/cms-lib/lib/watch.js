const path = require('path');
const chokidar = require('chokidar');

const { logger } = require('../logger');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
} = require('../errorHandlers');
const { uploadFolder } = require('./uploadFolder');
const { shouldIgnoreFile } = require('../ignoreRules');
const { getFileMapperApiQueryFromMode } = require('../fileMapper');
const { upload, deleteFile } = require('../api/fileMapper');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension } = require('../path');

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
  upload(portalId, file, dest, apiOptions)
    .then(() => {
      logger.log('Uploaded file "%s" to "%s"', file, dest);
    })
    .catch(() => {
      logger.debug('Uploading file "%s" to "%s" failed', file, dest);
      logger.debug('Retrying to upload file "%s" to "%s"', file, dest);
      upload(portalId, file, dest, apiOptions).catch(error => {
        logger.error('Uploading file "%s" to "%s" failed', file, dest);
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
}

function watch(portalId, src, dest, { mode, cwd, remove }) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);

  const watcher = chokidar.watch(src, {
    ignoreInitial: true,
  });

  const getDesignManagerPath = file => {
    const relativePath = file.replace(regex, '');
    return convertToUnixPath(path.join(dest, relativePath));
  };

  // Use uploadFolder so that failures of initial upload are retried
  uploadFolder(portalId, src, dest, { mode, cwd }).then(() => {
    logger.log(`Completed uploading files in ${src} to ${dest} in ${portalId}`);
  });

  watcher.on('ready', () => {
    logger.debug(`File watcher is ready and watching ${src}`);
  });

  watcher.on('add', file => {
    const destPath = getDesignManagerPath(file);
    uploadFile(portalId, file, destPath, { mode, cwd });
  });

  if (remove) {
    watcher.on('unlink', filePath => {
      const remotePath = getDesignManagerPath(filePath);

      if (shouldIgnoreFile(filePath, cwd)) {
        logger.debug(`Skipping ${filePath} due to an ignore rule`);
        return;
      }

      logger.debug('Attempting to delete file "%s"', remotePath);
      deleteFile(portalId, remotePath)
        .then(() => {
          logger.log('Deleted file "%s"', remotePath);
        })
        .catch(error => {
          logger.error('Deleting file "%s" failed', remotePath);
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

  watcher.on('change', file => {
    const destPath = getDesignManagerPath(file);
    uploadFile(portalId, file, destPath, { mode, cwd });
  });

  return watcher;
}

module.exports = {
  watch,
};
