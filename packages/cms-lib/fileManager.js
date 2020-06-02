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
const { convertToUnixPath, convertToLocalFileSystemPath } = require('./path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
  FileSystemErrorContext,
  logFileSystemErrorInstance,
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
async function fetchFile(portalId, file, dest, folderPath) {
  const relativePath = path.join(folderPath, `${file.name}.${file.extension}`);
  const destPath = convertToLocalFileSystemPath(path.join(dest, relativePath));
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

  await http.getOctetStream(
    portalId,
    {
      baseUrl: file.url,
      uri: '',
    },
    writeStream
  );
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
async function getFolderContents(portalId, dest, folderPath) {
  const files = await getAllPagedFiles(portalId, folderPath);

  for (const file of files) {
    await fetchFile(portalId, file, dest, folderPath);
  }

  const { objects: folders } = await getFoldersByPath(portalId, folderPath);
  for (const folder of folders) {
    await getFolderContents(portalId, dest, folder.full_path);
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
async function downloadFileOrFolder(portalId, remotePath, localDest) {
  const { file, folder } = await getStat(portalId, remotePath);

  if (file) {
    const folderPath = path.dirname(remotePath);

    fetchFile(portalId, file, localDest, folderPath);
  } else if (folder) {
    getFolderContents(portalId, localDest, folder.full_path);
  }
}

module.exports = {
  uploadFolder,
  downloadFileOrFolder,
};
