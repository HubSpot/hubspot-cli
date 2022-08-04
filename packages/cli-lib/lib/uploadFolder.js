const path = require('path');
const { default: PQueue } = require('p-queue');
const { logger } = require('../logger');
const {
  isProcessableFieldsJs,
  FieldsJs,
  createTmpDirSync,
  cleanupTmpDirSync,
} = require('./handleFieldsJs');
const { getFileMapperQueryValues } = require('../fileMapper');
const { upload } = require('../api/fileMapper');
const { createIgnoreFilter } = require('../ignoreRules');
const { walk, listFilesInDir } = require('./walk');
const { isModuleFolderChild } = require('../modules');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension, getExt } = require('../path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
} = require('../errorHandlers');

const FileUploadResultType = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};

const queue = new PQueue({
  concurrency: 10,
});

const FileTypes = {
  other: 'otherFiles',
  module: 'moduleFiles',
  cssAndJs: 'cssAndJsFiles',
  template: 'templateFiles',
  json: 'jsonFiles',
};

function getFileType(filePath) {
  const extension = getExt(filePath);
  const moduleFolder = isModuleFolderChild({ path: filePath, isLocal: true });
  if (moduleFolder) return FileTypes.module;

  switch (extension) {
    case 'js':
    case 'css':
      return FileTypes.cssAndJs;
    case 'html':
      return FileTypes.template;
    case 'json':
      return FileTypes.json;
    default:
      return FileTypes.other;
  }
}

function getFilesByType(filePaths, projectDir, rootWriteDir, processFieldsJs) {
  const projectDirRegex = new RegExp(`^${escapeRegExp(projectDir)}`);
  const fieldsJsObjects = [];

  // Create object with key-value pairs of form { FileType.type: [] }
  const filePathsByType = Object.assign(
    ...Object.values(FileTypes).map(key => ({ [key]: [] }))
  );

  filePaths.forEach(filePath => {
    const fileType = getFileType(filePath);
    const fileName = path.basename(filePath);
    const relativePath = filePath.replace(projectDirRegex, '');

    if (!processFieldsJs) {
      filePathsByType[fileType].push(filePath);
      return;
    }

    if (isProcessableFieldsJs(projectDir, filePath)) {
      const fieldsJs = new FieldsJs(projectDir, filePath, rootWriteDir);
      const rootOrModule =
        relativePath === '/fields.js' ? FileTypes.json : FileTypes.module;

      fieldsJsObjects.push(fieldsJs);
      filePathsByType[rootOrModule].push(fieldsJs);
    } else if (fileName === 'fields.json') {
      // Only add fields.json if there is no fields.js in the same directory.
      const dirFiles = listFilesInDir(path.dirname(filePath));
      if (!dirFiles.includes('fields.js')) {
        filePathsByType[fileType].push(filePath);
      }
    } else {
      filePathsByType[fileType].push(filePath);
    }
  });

  return [filePathsByType, fieldsJsObjects];
}

/**
 *
 * @param {number} accountId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function uploadFolder(
  accountId,
  src,
  dest,
  fileMapperOptions,
  commandOptions
) {
  const { saveOutput, processFieldsJs } = commandOptions;
  const tmpDir = processFieldsJs
    ? createTmpDirSync('hubspot-temp-fieldsjs-output-')
    : null;
  const regex = new RegExp(`^${escapeRegExp(src)}`);

  const files = await walk(src);
  const apiOptions = getFileMapperQueryValues(fileMapperOptions);
  const failures = [];
  let filesByType;
  let fieldsJsObjects = [];
  let fieldsJsPaths = [];
  let tmpDirRegex;

  const allowedFiles = files
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter());

  [filesByType, fieldsJsObjects] = getFilesByType(
    allowedFiles,
    src,
    tmpDir,
    processFieldsJs
  );
  if (fieldsJsObjects.length) {
    // Wait for each promise to resolve in sequence. Since we need to change the directory of the process during
    // FieldsJS processing, it is important that we wait for each fieldsjs to finish processing before moving on to the next
    for (let fieldsJs of fieldsJsObjects) {
      let outputPath = await fieldsJs.getOutputPathPromise();
      fieldsJs.outputPath = outputPath;
    }

    // By construction, the filesByType array will contain FieldsJs objects. Since we have now resolved the
    // outputPaths, go through and replace the objects with their outputPaths.
    filesByType = removeFieldsJsFromFilesByType(Object.values(filesByType));
    fieldsJsPaths = fieldsJsObjects.map(fieldsJs => fieldsJs.outputPath);
    tmpDirRegex = new RegExp(`^${escapeRegExp(tmpDir)}`);
  } else {
    filesByType = Object.values(filesByType);
  }
  const uploadFile = file => {
    // files in fieldsJsPaths always belong to the tmp directory.
    const relativePath = file.replace(
      fieldsJsPaths.includes(file) ? tmpDirRegex : regex,
      ''
    );
    const destPath = convertToUnixPath(path.join(dest, relativePath));
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

  // Implemented using a for loop due to async/await
  for (let i = 0; i < filesByType.length; i++) {
    const filesToUpload = filesByType[i];
    await queue.addAll(filesToUpload.map(uploadFile));
  }

  const results = await queue
    .addAll(
      failures.map(({ file, destPath }) => {
        return async () => {
          logger.debug('Retrying to upload file "%s" to "%s"', file, destPath);
          try {
            await upload(accountId, file, destPath, apiOptions);
            logger.log('Uploaded file "%s" to "%s"', file, destPath);
            return {
              resultType: FileUploadResultType.SUCCESS,
              error: null,
              file,
            };
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
            return {
              resultType: FileUploadResultType.FAILURE,
              error,
              file,
            };
          }
        };
      })
    )
    .finally(() => {
      if (!processFieldsJs) return;
      if (saveOutput) {
        fieldsJsObjects.forEach(fieldsJs => fieldsJs.saveOutput());
      }
      cleanupTmpDirSync(tmpDir);
    });

  return results;
}

function hasUploadErrors(results) {
  return results.some(
    result => result.resultType === FileUploadResultType.FAILURE
  );
}

function removeFieldsJsFromFilesByType(filesByType) {
  return filesByType.map(fileTypeArray =>
    fileTypeArray.map(filePath => {
      return filePath instanceof FieldsJs ? filePath.outputPath : filePath;
    })
  );
}

module.exports = {
  getFilesByType,
  hasUploadErrors,
  FileUploadResultType,
  uploadFolder,
  FileTypes,
};
