const fs = require('fs');
const path = require('path');

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
        walk(filepath).then(files => {
          return resolve({
            filepath,
            type: STAT_TYPES.DIRECTORY,
            files,
          });
        });
      } else if (stats.isFile()) {
        resolve({
          filepath,
          type: STAT_TYPES.FILE,
        });
      }
    });
  });
};

const filesDataReducer = (allFiles, fileData) => {
  switch (fileData.type) {
    case STAT_TYPES.FILE:
      return allFiles.concat(fileData.filepath);
    case STAT_TYPES.DIRECTORY:
      return allFiles.concat(fileData.files);
    case STAT_TYPES.SYMBOLIC_LINK:
      // Skip symlinks
      return allFiles;
    default:
      return allFiles;
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
