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
const { convertToUnixPath } = require('./path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
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
  const relativePath = `${folderPath}/${file.name}.${file.extension}`;
  const destPath = convertToUnixPath(path.join(dest, relativePath));

  let writeStream;

  try {
    await fs.ensureFile(destPath);
    writeStream = fs.createWriteStream(destPath, { encoding: 'binary' });
  } catch (err) {
    console.log(err);
    // logFsError(err);
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
 * @param {string} dest
 * @param {string} folderPath
 */
async function getFolderContents(portalId, dest, folderPath) {
  const { objects: files } = await getFilesByPath(portalId, folderPath);
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
