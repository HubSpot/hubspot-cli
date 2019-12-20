const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const { logFileSystemErrorInstance } = require('../errorHandlers');

const STAT_TYPES = {
  FILE: 'file',
  SYMBOLIC_LINK: 'symlink',
  DIRECTORY: 'dir',
};

const generateFilePromise = (dir, file) => {
  return new Promise((resolve, reject) => {
    const filepath = path.join(dir, file);
    fs.lstat(filepath, (error, stats) => {
      if (error) {
        reject(error);
      }
      if (stats.isSymbolicLink()) {
        resolve({
          filepath,
          type: STAT_TYPES.SYMBOLIC_LINK,
        });
      }
      if (stats.isDirectory()) {
        walk(filepath).then(fileContents => {
          return resolve({
            filepath,
            type: STAT_TYPES.DIRECTORY,
            fileContents,
          });
        });
      } else if (stats.isFile()) {
        resolve({
          filepath,
          type: STAT_TYPES.FILE,
        });
      }
    });
  }).catch(logger.error);
};

const filesDataReducer = (all, fileData) => {
  try {
    switch (fileData.type) {
      case STAT_TYPES.FILE:
        return all.concat(fileData.filepath);
      case STAT_TYPES.DIRECTORY:
        return all.concat(fileData.fileContents);
      case STAT_TYPES.SYMBOLIC_LINK:
        // Skip symlinks
        return all;
      default:
        return all;
    }
  } catch (e) {
    logFileSystemErrorInstance(e, fileData);
  }
};

function walk(dir) {
  const processFiles = files => {
    return Promise.all(files.map(file => generateFilePromise(dir, file)));
  };
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        reject(error);
      }
      processFiles(files).then(filesData => {
        resolve(filesData.reduce(filesDataReducer, []));
      });
    });
  });
}

module.exports = {
  walk,
};
