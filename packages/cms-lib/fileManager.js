const fs = require('fs-extra');
const path = require('path');

const {
  uploadFile,
  getStat,
  getFilesByPath,
  getFoldersByPath,
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
  }
}

/**
 *
 * @param {number} portalId
 * @param {object} file
 * @param {string} dest
 * @param {string} folderPath
 */
async function downloadFile(portalId, file, dest) {
  const fileName = `${file.name}.${file.extension}`;
  const destPath = convertToLocalFileSystemPath(path.join(dest, fileName));

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
async function getAllPagedFiles(portalId, folderPath) {
  let totalFiles = null;
  let files = [];
  let count = 0;
  let offset = 0;
  while (totalFiles === null || count < totalFiles) {
    const response = await getFilesByPath(portalId, folderPath, { offset });

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
 * @param {string} dest
 * @param {string} folderPath
 */
async function fetchFolderContents(portalId, folder, dest) {
  const files = await getAllPagedFiles(portalId, folder.full_path);

  for (const file of files) {
    await downloadFile(portalId, file, dest);
  }

  const { objects: folders } = await getFoldersByPath(
    portalId,
    folder.full_path
  );
  for (const folder of folders) {
    const subFolder = path.join(dest, folder.name);
    await fetchFolderContents(portalId, folder, subFolder);
  }
}

/**
 * Fetch a file/folder and write to local file system.
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function downloadFileOrFolder(portalId, src, dest) {
  const { file, folder } = await getStat(portalId, src);
  if (file) {
    try {
      await downloadFile(portalId, file, dest);
      logger.log(`File ${src} was downloaded to ${dest}`);
    } catch (err) {
      logErrorInstance(err);
    }
  } else if (folder) {
    try {
      const rootPath =
        dest === getCwd()
          ? convertToLocalFileSystemPath(path.resolve(dest, folder.name))
          : dest;
      await fetchFolderContents(portalId, folder, rootPath);
      logger.log('Completed fetch of folder "%s" to "%s"', src, dest);
    } catch (err) {
      logger.error('Failed fetch of folder "%s" to "%s"', src, dest);
    }
  }
}

module.exports = {
  uploadFolder,
  downloadFileOrFolder,
};
