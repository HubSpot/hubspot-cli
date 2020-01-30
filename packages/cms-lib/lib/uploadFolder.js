const path = require('path');
const { default: PQueue } = require('p-queue');

const { logger } = require('../logger');
const { getFileMapperApiQueryFromMode } = require('../fileMapper');
const { upload } = require('../api/fileMapper');
const { createIgnoreFilter } = require('../ignoreRules');
const { walk } = require('./walk');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension } = require('../path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
} = require('../errorHandlers');
const { triggerNotify } = require('./notify');

const queue = new PQueue({
  concurrency: 10,
});

async function uploadFile(portalId, file, destPath, apiOptions, notify) {
  const uploadPromise = upload(portalId, file, destPath, apiOptions);

  triggerNotify(notify, 'Uploaded', file, uploadPromise);
  uploadPromise.then(() => {
    logger.log('Uploaded file "%s" to "%s"', file, destPath);
  });

  return uploadPromise;
}

/**
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function uploadFolder(portalId, src, dest, { mode, cwd, notify }) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const apiOptions = {
    qs: getFileMapperApiQueryFromMode(mode),
  };
  const files = await walk(src);

  const filesToUpload = files
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter(cwd));

  const failures = [];
  await queue.addAll(
    filesToUpload.map(file => {
      const relativePath = file.replace(regex, '');
      const destPath = convertToUnixPath(path.join(dest, relativePath));
      return async () => {
        logger.debug('Attempting to upload file "%s" to "%s"', file, destPath);
        try {
          return uploadFile(portalId, file, destPath, apiOptions, notify);
        } catch (error) {
          if (isFatalError(error)) {
            throw error;
          }
          logger.debug(
            'Uploading file "%s" to "%s" failed so scheduled retry',
            file,
            destPath
          );
          if (error.response && error.response.body) {
            logger.debug(error.response.body);
          } else {
            logger.debug(error.message);
          }
          failures.push({
            file,
            destPath,
          });
        }
      };
    })
  );
  return queue.addAll(
    failures.map(({ file, destPath }) => {
      return async () => {
        logger.debug('Retrying to upload file "%s" to "%s"', file, destPath);
        try {
          return uploadFile(portalId, file, destPath, apiOptions, notify);
        } catch (error) {
          logger.error('Uploading file "%s" to "%s" failed', file, destPath);
          if (isFatalError(error)) {
            throw error;
          }
          logApiUploadErrorInstance(
            error,
            new ApiErrorContext({
              portalId,
              request: destPath,
              payload: file,
            })
          );
        }
      };
    })
  );
}

module.exports = {
  uploadFolder,
};
