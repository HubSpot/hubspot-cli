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

const formatFilesData = filesData => {
  return filesData.reduce((acc, fileData) => {
    switch (fileData.type) {
      case STAT_TYPES.FILE:
        return acc.concat(fileData.filepath);
      case STAT_TYPES.DIRECTORY:
        return acc.concat(fileData.files || []);
      case STAT_TYPES.SYMBOLIC_LINK:
        // Skip symlinks
        return acc;
      default:
        return acc;
    }
  }, []);
};

async function read(dir) {
  const processFiles = files =>
    Promise.all(files.map(file => generateFilePromise(dir, file)));

  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        reject(error);
      }
      processFiles(files).then(filesData => {
        resolve(formatFilesData(filesData));
      });
    });
  });
}

module.exports = {
  formatFilesData,
  generateFilePromise,
  read,
  STAT_TYPES,
};
