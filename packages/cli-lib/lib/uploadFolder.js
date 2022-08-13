const path = require('path');
const { fieldsJsPrompt } = require('@hubspot/cli/lib/prompts/uploadPrompt');
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
const { walk } = require('./walk');
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

async function getFilesByType(
  filePaths,
  projectDir,
  rootWriteDir,
  commandOptions
) {
  const { processFieldsJs, fieldOptions } = commandOptions;
  const projectDirRegex = new RegExp(`^${escapeRegExp(projectDir)}`);
  const fieldsJsObjects = [];

  // Create object with key-value pairs of form { FileType.type: [] }
  const filePathsByType = Object.assign(
    ...Object.values(FileTypes).map(key => ({ [key]: [] }))
  );
  let skipFiles = [];
  for (const filePath of filePaths) {
    const fileType = getFileType(filePath);
    const fileName = path.basename(filePath);
    const relPath = filePath.replace(projectDirRegex, '');

    if (!processFieldsJs) {
      filePathsByType[fileType].push(filePath);
      continue;
    }
    if (skipFiles.includes(filePath)) continue;

    const processableFields = isProcessableFieldsJs(projectDir, filePath);
    if (processableFields || fileName == 'fields.json') {
      // This prompt checks if there are multiple field files in the folder and gets user to choose.
      const [choice, updatedSkipFiles] = await fieldsJsPrompt(
        filePath,
        projectDir,
        skipFiles
      );
      skipFiles = updatedSkipFiles;
      // If they chose something other than the current file, move on.
      if (choice !== filePath) continue;
    }

    if (processableFields) {
      const rootOrModule =
        path.dirname(relPath) === '/' ? FileTypes.json : FileTypes.module;
      const fieldsJs = await new FieldsJs(
        projectDir,
        filePath,
        rootWriteDir,
        fieldOptions
      ).init();

      /*
       * A fields.js will be rejected if the promise is rejected or if the some other error occurs.
       * We handle this gracefully by not adding the failed fields.js to the object list.
       */
      if (fieldsJs.rejected) continue;

      fieldsJsObjects.push(fieldsJs);
      filePathsByType[rootOrModule].push(fieldsJs.outputPath);
    } else {
      filePathsByType[fileType].push(filePath);
    }
  }
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

  [filesByType, fieldsJsObjects] = await getFilesByType(
    allowedFiles,
    src,
    tmpDir,
    commandOptions
  );
  filesByType = Object.values(filesByType);
  if (fieldsJsObjects.length) {
    fieldsJsPaths = fieldsJsObjects.map(fieldsJs => fieldsJs.outputPath);
    tmpDirRegex = new RegExp(`^${escapeRegExp(tmpDir)}`);
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

module.exports = {
  getFilesByType,
  hasUploadErrors,
  FileUploadResultType,
  uploadFolder,
  FileTypes,
};
