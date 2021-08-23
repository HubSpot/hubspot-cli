const path = require('path');
const { default: PQueue } = require('p-queue');

const { logger } = require('../logger');
const { getFileMapperQueryValues } = require('../fileMapper');
const { upload } = require('../api/fileMapper');
const { createIgnoreFilter } = require('../ignoreRules');
const { walk } = require('./walk');
const escapeRegExp = require('./escapeRegExp');
const {
  convertToUnixPath,
  isAllowedExtension,
  getExt,
  splitLocalPath,
} = require('../path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
} = require('../errorHandlers');
const { FUNCTION_FOLDER_REGEX } = require('./regex');

const queue = new PQueue({
  concurrency: 10,
});

function getFilesByType(files) {
  const moduleFiles = [];
  const cssAndJsFiles = [];
  const otherFiles = [];
  const templateFiles = [];
  const jsonFiles = [];

  files.forEach(file => {
    const parts = splitLocalPath(file);
    const extension = getExt(file);

    const moduleFolder = parts.find(part => part.endsWith('.module'));
    if (moduleFolder) {
      moduleFiles.push(file);
    } else if (extension === 'js' || extension === 'css') {
      cssAndJsFiles.push(file);
    } else if (extension === 'html') {
      templateFiles.push(file);
    } else if (extension === 'json') {
      jsonFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  });

  return [otherFiles, moduleFiles, cssAndJsFiles, templateFiles, jsonFiles];
}
/**
 *
 * @param {number} accountId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function uploadFolder(accountId, src, dest, options) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const files = await walk(src);
  let functionFolders = [];

  const allowedFiles = files
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter());

  const filesByType = getFilesByType(allowedFiles);
  const apiOptions = getFileMapperQueryValues(options);

  const failures = [];

  const uploadFile = file => {
    const relativePath = file.replace(regex, '');
    const destPath = convertToUnixPath(path.join(dest, relativePath));
    const functionFolder = relativePath.match(FUNCTION_FOLDER_REGEX);

    if (functionFolder && functionFolders.indexOf(functionFolder[0]) === -1) {
      functionFolders.push(functionFolder[0]);
    }

    return async () => {
      logger.debug('Attempting to upload file "%s" to "%s"', file, destPath);
      try {
        await upload(accountId, file, destPath, apiOptions);
        logger.log('Uploaded file "%s" to "%s"', file, destPath);
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
  };

  // Implemented using a for lop due to async/await
  for (let i = 0; i < filesByType.length; i++) {
    const filesToUpload = filesByType[i];
    await queue.addAll(filesToUpload.map(uploadFile));
  }

  if (functionFolders.length === 1) {
    logger.info(
      `${functionFolders[0]} has not been deployed. Run 'hs functions deploy' to complete the deployment process.`
    );
  } else if (functionFolders.length > 1) {
    logger.info(
      `${functionFolders.join(
        ', '
      )} have not been deployed. Run 'hs functions deploy' for each function folder to complete the deployment process.`
    );
  }

  return queue.addAll(
    failures.map(({ file, destPath }) => {
      return async () => {
        logger.debug('Retrying to upload file "%s" to "%s"', file, destPath);
        try {
          await upload(accountId, file, destPath, apiOptions);
          logger.log('Uploaded file "%s" to "%s"', file, destPath);
        } catch (error) {
          logger.error('Uploading file "%s" to "%s" failed', file, destPath);
          if (isFatalError(error)) {
            throw error;
          }
          logApiUploadErrorInstance(
            error,
            new ApiErrorContext({
              accountId,
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
