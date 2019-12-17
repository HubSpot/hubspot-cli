const path = require('path');
const { default: PQueue } = require('p-queue');

const { uploadFile } = require('./api/fileManager');
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { createIgnoreFilter } = require('./ignoreRules');
const escapeRegExp = require('./lib/escapeRegExp');
const { convertToUnixPath } = require('./path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
} = require('./errorHandlers');

const queue = new PQueue({
  concurrency: 10,
});

/**
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function uploadFolder(portalId, src, dest, { cwd }) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const files = await walk(src);

  const filesToUpload = files.filter(createIgnoreFilter(cwd));

  return queue.addAll(
    filesToUpload.map(file => {
      const relativePath = file.replace(regex, '');
      const destPath = convertToUnixPath(path.join(dest, relativePath));
      return async () => {
        logger.debug('Attempting to upload file "%s" to "%s"', file, destPath);
        try {
          await uploadFile(portalId, file, destPath);
          logger.log('Uploaded file "%s" to "%s"', file, destPath);
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
