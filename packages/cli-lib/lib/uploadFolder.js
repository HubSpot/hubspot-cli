const fs = require('fs');
const os = require('os');
const path = require('path');
const yargs = require('yargs');
const { default: PQueue } = require('p-queue');
const { logger } = require('../logger');
const { convertFieldsJs } = require('./handleFieldsJs');
const { getFileMapperQueryValues } = require('../fileMapper');
const { upload } = require('../api/fileMapper');
const { createIgnoreFilter } = require('../ignoreRules');
const { walk, listFilesInDir } = require('./walk');
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

const FileUploadResultType = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};

const queue = new PQueue({
  concurrency: 10,
});

function getFilesByTypeAndProcessFields(files, src, writeDir = src) {
  const writeDirRegex = new RegExp(`^${escapeRegExp(src)}`);
  const moduleFiles = [];
  const cssAndJsFiles = [];
  const otherFiles = [];
  const templateFiles = [];
  const jsonFiles = [];
  const compiledJsonFiles = [];

  const fieldsJsInRoot = listFilesInDir(src).includes('fields.js');
  const options = yargs.argv.options;

  files.forEach(file => {
    const parts = splitLocalPath(file);
    const extension = getExt(file);
    const moduleFolder = parts.find(part => part.endsWith('.module'));
    const fileName = parts[parts.length - 1];
    const relativePath = file.replace(writeDirRegex, '');

    if (fileName == 'fields.output.json') {
      return;
    }
    if (moduleFolder) {
      //If the folder contains a fields.js, we will always overwrite the existing fields.json.
      if (fileName === 'fields.js') {
        const compiledJsonPath = convertFieldsJs(
          file,
          options,
          path.dirname(path.join(writeDir, relativePath))
        );

        moduleFiles.push(compiledJsonPath);
        compiledJsonFiles.push(compiledJsonPath);
      } else {
        if (getExt(file) == 'json') {
          // Don't push any JSON files that are in the modules folder besides fields & meta or the design manager will get mad.
          if (fileName == 'meta.json') {
            moduleFiles.push(file);
          }

          if (fileName === 'fields.json') {
            // If the folder contains a fields.js, then do not push the fields.json - we will push our own.
            const dir = listFilesInDir(path.dirname(file));
            if (!dir.includes('fields.js')) {
              moduleFiles.push(file);
            }
          }
        } else {
          moduleFiles.push(file);
        }
      }
    } else if (extension === 'js' || extension === 'css') {
      if (fileName === 'fields.js') {
        if (relativePath == '/fields.js') {
          // Root fields.js
          const compiledJsonPath = convertFieldsJs(file, options, writeDir);
          jsonFiles.push(compiledJsonPath);
          compiledJsonFiles.push(compiledJsonPath);
        }
      } else {
        cssAndJsFiles.push(file);
      }
    } else if (extension === 'html') {
      templateFiles.push(file);
    } else if (extension === 'json') {
      if (fileName == 'fields.json') {
        // Only add a fields.json if there is not a fields.js.
        if (!fieldsJsInRoot) {
          jsonFiles.push(file);
        }
      } else {
        jsonFiles.push(file);
      }
    } else {
      otherFiles.push(file);
    }
  });

  // These could contain promises!
  return [
    [otherFiles, moduleFiles, cssAndJsFiles, templateFiles, jsonFiles],
    compiledJsonFiles,
  ];
}

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
async function uploadFolder(accountId, src, dest, options, saveOutput = true) {
  const tmpDir = createTmpDir();
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const tmpDirRegex = new RegExp(`^${escapeRegExp(tmpDir)}`);
  const files = await walk(src);
  const apiOptions = getFileMapperQueryValues(options);
  const failures = [];
  const processFields = yargs.argv.processFields;
  let filesByType;
  let compiledJsonFiles = [];

  const allowedFiles = files
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter());

  if (processFields) {
    // These might contain promises, so resolve first.
    [filesByType, compiledJsonFiles] = await resolvePromises(
      getFilesByTypeAndProcessFields(allowedFiles, src, tmpDir)
    );
  } else {
    filesByType = getFilesByType(allowedFiles, src);
  }

  const uploadFile = file => {
    // files in compiledJsonFiles always belong to the tmp directory.
    const relativePath = file.replace(
      compiledJsonFiles.includes(file) ? tmpDirRegex : regex,
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
      if (!processFields) return;
      if (typeof yargs.argv.saveOutput !== undefined) {
        saveOutput = yargs.argv.saveOutput;
      }

      // After uploading the compiled json files, delete/keep based on user choice
      if (saveOutput) {
        compiledJsonFiles.forEach(filePath => {
          // Save in same directory as respective fields.js.
          const relativePath = path.relative(tmpDir, path.dirname(filePath));
          const savePath = path.join(src, relativePath, 'fields.output.json');
          try {
            fs.copyFileSync(filePath, savePath);
          } catch (err) {
            logger.error(
              `There was an error saving the json output to ${savePath}`
            );
            throw err;
          }
        });
      }
      // Delete tmp directory
      if (processFields) {
        fs.rm(tmpDir, { recursive: true }, err => {
          if (err) {
            logger.error(
              'There was an error deleting the temporary project source'
            );
            throw err;
          }
        });
      }
    });

  return results;
}

function hasUploadErrors(results) {
  return results.some(
    result => result.resultType === FileUploadResultType.FAILURE
  );
}

async function resolvePromises([filesByTypePromises, compiledJsonPromises]) {
  const filesByType = await Promise.all(
    filesByTypePromises.map(typeArray => Promise.all(typeArray))
  );
  const compiledJsonFiles = await Promise.all(compiledJsonPromises);
  return [filesByType, compiledJsonFiles];
}

function createTmpDir() {
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'hubspot-temp-fieldsjs-output-')
    );
  } catch (err) {
    logger.error('An error occured writing temporary project source.');
    throw err;
  }
  return tmpDir;
}

module.exports = {
  getFilesByType,
  hasUploadErrors,
  FileUploadResultType,
  uploadFolder,
  resolvePromises,
  createTmpDir,
  getFilesByTypeAndProcessFields,
};
