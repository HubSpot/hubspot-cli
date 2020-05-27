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
 * Fetch a file/folder and write to local file system.
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function downloadFileOrFolder(portalId, src, dest) {
  const { file, folder } = await getStat(portalId, src);

  async function getFolderContents(folderPath) {
    const files = await getFilesByPath(portalId, folderPath);
    files.objects.forEach(async f => {
      const relativePath = `${folderPath}/${f.name}.${f.extension}`;
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
          baseUrl: f.url,
          uri: '',
        },
        writeStream
      );

      // console.log(`File ${f.name}.${f.extension} was successfully download to ${relativePath}`)
      // console.log(relativePath)
    });
    const folders = await getFoldersByPath(portalId, folderPath);
    folders.objects.forEach(f => {
      getFolderContents(f.full_path);
    });
  }

  if (file) {
    console.log(`${file.name}.${file.extension}`);
  } else if (folder) {
    getFolderContents(folder.full_path);
  }

  // try {
  //   if (!(input && input.src)) {
  //     return;
  //   }
  //   const { isFile } = getTypeDataFromPath(input.src);
  //   if (isFile) {
  //     await downloadFile(input);
  //   } else {
  //     await downloadFolder(input);
  //   }
  // } catch (err) {
  //   // Specific handlers provide logging.
  // }
}

module.exports = {
  uploadFolder,
  downloadFileOrFolder,
};
