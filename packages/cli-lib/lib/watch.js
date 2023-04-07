const path = require('path');
const chokidar = require('chokidar');
const { default: PQueue } = require('p-queue');

const { logger } = require('../logger');
const debounce = require('debounce');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logErrorInstance,
} = require('../errorHandlers');
const { isConvertableFieldJs, FieldsJs } = require('./handleFieldsJs');
const { uploadFolder } = require('./uploadFolder');
const { shouldIgnoreFile, ignoreFile } = require('../ignoreRules');
const { getFileMapperQueryValues } = require('../fileMapper');
const { upload, deleteFile } = require('../api/fileMapper');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension, getCwd } = require('../path');
const { triggerNotify } = require('./notify');
const { getThemePreviewUrl, getThemeJSONPath } = require('./files');

const queue = new PQueue({
  concurrency: 10,
});

const _notifyOfThemePreview = (filePath, accountId) => {
  if (queue.size > 0) return;
  const previewUrl = getThemePreviewUrl(filePath, accountId);
  if (!previewUrl) return;

  logger.log(`
  To preview this theme, visit:
  ${previewUrl}
  `);
};
const notifyOfThemePreview = debounce(_notifyOfThemePreview, 1000);

async function uploadFile(accountId, file, dest, options) {
  const src = options.src;

  let absoluteSrcPath = path.resolve(getCwd(), file);
  const themeJsonPath = getThemeJSONPath(absoluteSrcPath);
  const projectRoot = themeJsonPath
    ? path.dirname(themeJsonPath)
    : path.dirname(getCwd());

  const convertFields = isConvertableFieldJs(
    src,
    file,
    options.commandOptions.convertFields
  );

  if (!isAllowedExtension(file) && !convertFields) {
    logger.debug(`Skipping ${file} due to unsupported extension`);
    return;
  }
  if (shouldIgnoreFile(file)) {
    logger.debug(`Skipping ${file} due to an ignore rule`);
    return;
  }

  let fieldsJs;
  if (convertFields) {
    fieldsJs = await new FieldsJs(
      projectRoot,
      absoluteSrcPath,
      undefined,
      options.fieldOptions
    ).init();
    if (fieldsJs.rejected) return;
    // Ensures that the dest path is a .json. The user might pass '.js' accidentally - this ensures it just works.
    dest = convertToUnixPath(path.join(path.dirname(dest), 'fields.json'));
  }
  const fileToUpload = convertFields ? fieldsJs.outputPath : file;

  logger.debug('Attempting to upload file "%s" to "%s"', file, dest);
  const apiOptions = getFileMapperQueryValues(options);
  return queue.add(() => {
    return upload(accountId, fileToUpload, dest, apiOptions)
      .then(() => {
        logger.log(`Uploaded file ${file} to ${dest}`);
        notifyOfThemePreview(file, accountId);
      })
      .catch(() => {
        const uploadFailureMessage = `Uploading file ${file} to ${dest} failed`;
        logger.debug(uploadFailureMessage);
        logger.debug('Retrying to upload file "%s" to "%s"', file, dest);
        return upload(accountId, file, dest, apiOptions).catch(error => {
          logger.error(uploadFailureMessage);
          logApiUploadErrorInstance(
            error,
            new ApiErrorContext({
              accountId,
              request: dest,
              payload: file,
            })
          );
        });
      });
  });
}

async function deleteRemoteFile(accountId, filePath, remoteFilePath) {
  if (shouldIgnoreFile(filePath)) {
    logger.debug(`Skipping ${filePath} due to an ignore rule`);
    return;
  }

  logger.debug('Attempting to delete file "%s"', remoteFilePath);
  return queue.add(() => {
    return deleteFile(accountId, remoteFilePath)
      .then(() => {
        logger.log(`Deleted file ${remoteFilePath}`);
        notifyOfThemePreview(filePath, accountId);
      })
      .catch(error => {
        logger.error(`Deleting file ${remoteFilePath} failed`);
        logApiErrorInstance(
          error,
          new ApiErrorContext({
            accountId,
            request: remoteFilePath,
          })
        );
      });
  });
}

function watch(
  accountId,
  src,
  dest,
  { mode, remove, disableInitial, notify, commandOptions, filePaths },
  postInitialUploadCallback = null
) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  if (notify) {
    ignoreFile(notify);
  }

  const watcher = chokidar.watch(src, {
    ignoreInitial: true,
    ignored: file => shouldIgnoreFile(file),
  });

  const getDesignManagerPath = file => {
    const relativePath = file.replace(regex, '');
    return convertToUnixPath(path.join(dest, relativePath));
  };

  if (!disableInitial) {
    // Use uploadFolder so that failures of initial upload are retried
    uploadFolder(accountId, src, dest, { mode }, commandOptions, filePaths)
      .then(result => {
        logger.success(
          `Completed uploading files in ${src} to ${dest} in ${accountId}`
        );
        if (postInitialUploadCallback) {
          postInitialUploadCallback(result);
        }
      })
      .catch(error => {
        logger.error(
          `Initial uploading of folder "${src}" to "${dest} in account ${accountId} failed`
        );
        logErrorInstance(error, {
          accountId,
        });
      });
  }

  watcher.on('ready', () => {
    logger.log(
      `Watcher is ready and watching ${src}. Any changes detected will be automatically uploaded and overwrite the current version in the developer file system.`
    );
  });

  watcher.on('add', async filePath => {
    const destPath = getDesignManagerPath(filePath);
    const uploadPromise = uploadFile(accountId, filePath, destPath, {
      src,
      mode,
      commandOptions,
    });
    triggerNotify(notify, 'Added', filePath, uploadPromise);
  });

  if (remove) {
    const deleteFileOrFolder = type => filePath => {
      // If it's a fields.js file that is in a module folder or the root, then ignore because it will not exist on the server.
      if (isConvertableFieldJs(src, filePath, commandOptions.convertFields)) {
        return;
      }

      const remotePath = getDesignManagerPath(filePath);
      if (shouldIgnoreFile(filePath)) {
        logger.debug(`Skipping ${filePath} due to an ignore rule`);
        return;
      }

      logger.debug('Attempting to delete %s "%s"', type, remotePath);
      queue.add(() => {
        const deletePromise = deleteRemoteFile(accountId, filePath, remotePath)
          .then(() => {
            logger.log('Deleted %s "%s"', type, remotePath);
          })
          .catch(error => {
            logger.error('Deleting %s "%s" failed', type, remotePath);
            logApiErrorInstance(
              error,
              new ApiErrorContext({
                accountId,
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
    const uploadPromise = uploadFile(accountId, filePath, destPath, {
      src,
      mode,
      commandOptions,
    });
    triggerNotify(notify, 'Changed', filePath, uploadPromise);
  });

  return watcher;
}

module.exports = {
  watch,
};
