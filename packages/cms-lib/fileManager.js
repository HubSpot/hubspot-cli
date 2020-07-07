const fs = require('fs-extra');
const path = require('path');

const {
  uploadFile,
  fetchStat,
  fetchFiles,
  fetchFolders,
} = require('./api/fileManager');
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { createIgnoreFilter } = require('./ignoreRules');
const http = require('./http');
const escapeRegExp = require('./lib/escapeRegExp');
const {
  getCwd,
  convertToUnixPath,
  convertToLocalFileSystemPath,
} = require('./path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
  FileSystemErrorContext,
  logFileSystemErrorInstance,
  logApiErrorInstance,
  logErrorInstance,
} = require('./errorHandlers');

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

  const len = filesToUpload.length;
  for (let index = 0; index < len; index++) {
    const file = filesToUpload[index];
    const relativePath = file.replace(regex, '');
    const destPath = convertToUnixPath(path.join(dest, relativePath));
    logger.debug(
      'Uploading files from "%s" to "%s" in the File Manager of portal %s',
      file,
      destPath,
      portalId
    );
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
  }
}

/**
 * @private
 * @async
 * @param {boolean} input
 * @param {string} filepath
 * @returns {Promise<boolean}
 */
async function skipExisting(overwrite, filepath) {
  if (overwrite) {
    return false;
  }
  if (await fs.pathExists(filepath)) {
    logger.log('Skipped existing "%s"', filepath);
    return true;
  }
  return false;
}

/**
 *
 * @param {number} portalId
 * @param {object} file
 * @param {string} dest
 * @param {object} options
 */
async function downloadFile(portalId, file, dest, options) {
  const fileName = `${file.name}.${file.extension}`;
  const destPath = convertToLocalFileSystemPath(path.join(dest, fileName));

  if (await skipExisting(options.overwrite, destPath)) {
    return;
  }

  const logFsError = err => {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        destPath,
        portalId,
        write: true,
      })
    );
  };
  let writeStream;

  try {
    await fs.ensureFile(destPath);
    writeStream = fs.createWriteStream(destPath, { encoding: 'binary' });
  } catch (err) {
    logFsError(err);
    throw err;
  }

  try {
    await http.getOctetStream(
      portalId,
      {
        baseUrl: file.url,
        uri: '',
      },
      writeStream
    );
    logger.log(`Wrote file "${destPath}"`);
  } catch (err) {
    logErrorInstance(err);
  }
}

/**
 *
 * @param {number} portalId
 * @param {string} folderPath
 */
async function fetchAllPagedFiles(portalId, folderId, { includeArchived }) {
  let totalFiles = null;
  let files = [];
  let count = 0;
  let offset = 0;
  while (totalFiles === null || count < totalFiles) {
    const response = await fetchFiles(portalId, folderId, {
      offset,
      archived: includeArchived,
    });

    if (totalFiles === null) {
      totalFiles = response.total;
    }

    count += response.objects.length;
    offset += response.objects.length;
    files = files.concat(response.objects);
  }
  return files;
}

/**
 *
 * @param {number} portalId
 * @param {object} folder
 * @param {string} dest
 * @param {object} options
 */
async function fetchFolderContents(portalId, folder, dest, options) {
  const files = await fetchAllPagedFiles(portalId, folder.id, options);
  for (const file of files) {
    await downloadFile(portalId, file, dest, options);
  }

  const { objects: folders } = await fetchFolders(portalId, folder.id);
  for (const folder of folders) {
    const nestedFolder = path.join(dest, folder.name);
    await fetchFolderContents(portalId, folder, nestedFolder, options);
  }
}

/**
 * Download a folder and write to local file system.
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} file
 * @param {object} options
 */
async function downloadFolder(portalId, src, dest, folder, options) {
  try {
    const rootPath =
      dest === getCwd()
        ? convertToLocalFileSystemPath(path.resolve(dest, folder.name))
        : dest;
    logger.log(
      'Fetching folder from "%s" to "%s" in the File Manager of portal %s',
      src,
      rootPath,
      portalId
    );
    await fetchFolderContents(portalId, folder, rootPath, options);
    logger.success(
      'Completed fetch of folder "%s" to "%s" from the File Manager',
      src,
      dest
    );
  } catch (err) {
    logErrorInstance(err);
  }
}

/**
 * Download a single file and write to local file system.
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} file
 * @param {object} options
 */
async function downloadSingleFile(portalId, src, dest, file, options) {
  if (!options.includeArchived && file.archived) {
    logger.error(
      '"%s" in the File Manager is an archived file. Try fetching again with the "--inclulde-archived" flag.',
      src
    );
    return;
  }
  if (file.hidden) {
    logger.error('"%s" in the File Manager is a hidden file.', src);
    return;
  }

  try {
    logger.log(
      'Fetching file from "%s" to "%s" in the File Manager of portal %s',
      src,
      dest,
      portalId
    );
    await downloadFile(portalId, file, dest, options);
    logger.success(
      'Completed fetch of file "%s" to "%s" from the File Manager',
      src,
      dest
    );
  } catch (err) {
    logErrorInstance(err);
  }
}

/**
 * Lookup path in file manager and initiate download
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function downloadFileOrFolder(portalId, src, dest, options) {
  if (src === '/') {
    await downloadFolder(portalId, src, dest, '', options);
  } else {
    try {
      const { file, folder } = await fetchStat(portalId, src);

      if (file) {
        downloadSingleFile(portalId, src, dest, file, options);
      } else if (folder) {
        downloadFolder(portalId, src, dest, folder, options);
      }
    } catch (err) {
      logApiErrorInstance(
        err,
        new ApiErrorContext({
          request: src,
          portalId,
        })
      );
    }
  }
}

module.exports = {
  uploadFolder,
  downloadFileOrFolder,
};
