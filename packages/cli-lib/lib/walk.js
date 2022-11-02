const fs = require('fs');

const { logger } = require('../logger');
const {
  getFileInfoAsync,
  flattenAndRemoveSymlinks,
  STAT_TYPES,
} = require('./read');

const listFilesInDir = dir => {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(file => !file.isDirectory())
    .map(file => file.name);
};

const generateRecursiveFilePromise = async (dir, file) => {
  return getFileInfoAsync(dir, file).then(fileData => {
    return new Promise(resolve => {
      if (fileData.type === STAT_TYPES.DIRECTORY) {
        walk(fileData.filepath).then(files => {
          resolve({ ...fileData, files });
        });
      } else {
        resolve(fileData);
      }
    });
  });
};

async function walk(dir) {
  const processFiles = files =>
    Promise.all(files.map(file => generateRecursiveFilePromise(dir, file)));

  return fs.promises
    .readdir(dir)
    .then(processFiles)
    .then(flattenAndRemoveSymlinks)
    .catch(err => {
      logger.debug(err);
      return [];
    });
}

module.exports = {
  walk,
  listFilesInDir,
};
