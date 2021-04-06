const fs = require('fs');
const path = require('path');

const { logger } = require('../logger');

const STAT_TYPES = {
  FILE: 'file',
  SYMBOLIC_LINK: 'symlink',
  DIRECTORY: 'dir',
};

const getFileInfoAsync = (dir, file) => {
  return new Promise((resolve, reject) => {
    const filepath = path.join(dir, file);
    fs.lstat(filepath, (error, stats) => {
      if (error) {
        reject(error);
      }
      let type;
      if (stats.isSymbolicLink()) {
        type = STAT_TYPES.SYMBOLIC_LINK;
      } else if (stats.isDirectory()) {
        type = STAT_TYPES.DIRECTORY;
      } else if (stats.isFile()) {
        type = STAT_TYPES.FILE;
      }
      resolve({ filepath, type });
    });
  });
};

const flattenAndRemoveSymlinks = filesData => {
  return filesData.reduce((acc, fileData) => {
    switch (fileData.type) {
      case STAT_TYPES.FILE:
        return acc.concat(fileData.filepath);
      case STAT_TYPES.DIRECTORY:
        return acc.concat(fileData.files || []);
      case STAT_TYPES.SYMBOLIC_LINK:
        return acc;
      default:
        return acc;
    }
  }, []);
};

async function read(dir) {
  const processFiles = files =>
    Promise.all(files.map(file => getFileInfoAsync(dir, file)));

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
  flattenAndRemoveSymlinks,
  getFileInfoAsync,
  read,
  STAT_TYPES,
};
